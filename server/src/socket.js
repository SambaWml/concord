import { v4 as uuidv4 } from "uuid";
import crypto from "node:crypto";
import {
  DEFAULT_GUILD_ID,
  findUserByNickname,
  findUserById,
  createUser,
  setPasswordHash,
  touchLastSeen,
  createGuild,
  getGuildById,
  getGuildsForUser,
  isGuildMember,
  addGuildMember,
  createInvite,
  getInvite,
  getInviteForGuild,
  createChannel,
  getChannelsForGuild,
  getChannelById,
  deleteChannel,
  insertMessage,
  getRecentMessages,
  getMessageById,
  deleteMessage,
  isBanned,
  banUser,
  addAuditLog,
  createWebhook,
  getWebhooksForGuild,
  deleteWebhook,
  getFriendshipEither,
  createFriendRequest,
  acceptFriendRequest,
  deleteFriendshipEither,
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
} from "./db.js";
import { hashPassword, verifyPassword } from "./auth.js";

const MAX_NICKNAME_LEN = 24;
const MAX_MESSAGE_LEN = 2000;
const MAX_GUILD_NAME_LEN = 50;
const MAX_CHANNEL_NAME_LEN = 40;
const MIN_PASSWORD_LEN = 4;
const RATE_LIMIT_MAX = 5; // mensagens...
const RATE_LIMIT_WINDOW_MS = 10_000; // ...por 10 segundos
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O, 1/I/l

// "admin" continua sendo uma lista de apelidos de confiança por variável de
// ambiente (super-admin em qualquer servidor) — além disso, o dono de cada
// servidor tem poder de moderação só dentro do que criou (ver isGuildOwner).
const ADMIN_NICKNAMES = new Set(
  (process.env.ADMIN_NICKNAMES || "")
    .split(",")
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean)
);
const isAdminNickname = (nickname) => ADMIN_NICKNAMES.has(String(nickname || "").toLowerCase());

// Salas do Socket.io: uma por servidor (presença/avisos gerais), uma por
// canal de texto (chat daquele canal) e uma por canal de voz (sinalização
// daquele canal) — assim uma mensagem de #geral nunca vaza pra #memes.
const guildRoom = (id) => `g:${id}`;
const channelRoom = (id) => `c:${id}`;
const voiceChannelRoom = (id) => `v:${id}`;

function generateInviteCode() {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += INVITE_ALPHABET[crypto.randomInt(INVITE_ALPHABET.length)];
  }
  return code;
}

function sanitizeChannelName(type, name) {
  const clean = String(name || "").trim().slice(0, MAX_CHANNEL_NAME_LEN);
  if (!clean) return null;
  // canais de texto seguem a convenção "sem espaço, minúsculo" tipo Discord
  return type === "text" ? clean.toLowerCase().replace(/\s+/g, "-") : clean;
}

// Todo handler abaixo desestrutura o payload direto no parâmetro (ex:
// `({ channelId }) => ...`). Se algum cliente mandar o evento sem payload
// (aba com versão antiga, cliente mal-feito, etc.), essa desestruturação de
// `undefined` derruba o processo inteiro pra todo mundo — já aconteceu em
// produção. Esse wrapper garante que um handler que falhar só loga o erro,
// nunca crasha o servidor.
function safeOn(socket, event, handler) {
  socket.on(event, (...args) => {
    try {
      const result = handler(...args);
      if (result && typeof result.catch === "function") {
        result.catch((err) => console.error(`socket:${event} falhou`, err));
      }
    } catch (err) {
      console.error(`socket:${event} falhou`, err);
    }
  });
}

export function attachSocket(io) {
  // Estado em memória — some sozinho se o processo reiniciar; histórico,
  // membros, canais, convites e bans vão pro banco.
  const online = new Map(); // guildId -> Map<socket.id, {userId, nickname, isAdmin}>
  const voiceRoom = new Map(); // channelId (de voz) -> Map<socket.id, {userId, nickname}>
  const sessions = new Map(); // sessionToken -> { userId, nickname }
  // Independe de servidor — pra notificar um amigo (pedido/aceite) não
  // importa em qual servidor ele esteja olhando agora, ou se está em nenhum.
  const userSockets = new Map(); // userId -> Set<socket.id>

  const onlineList = (guildId) => [...(online.get(guildId)?.values() || [])];
  const voiceRoster = (channelId) =>
    [...(voiceRoom.get(channelId)?.entries() || [])].map(([socketId, v]) => ({ socketId, ...v }));

  const isUserOnline = (userId) => (userSockets.get(userId)?.size || 0) > 0;
  function emitToUser(userId, event, payload) {
    for (const sid of userSockets.get(userId) || []) io.to(sid).emit(event, payload);
  }

  const socketsInGuild = (guildId, targetUserId) => {
    const room = io.sockets.adapter.rooms.get(guildRoom(guildId));
    if (!room) return [];
    return [...room]
      .map((id) => io.sockets.sockets.get(id))
      .filter((s) => s && s.data.userId === targetUserId);
  };

  function leaveVoiceChannel(socket) {
    const channelId = socket.data.currentVoiceChannelId;
    const room = channelId && voiceRoom.get(channelId);
    if (!room || !room.has(socket.id)) return;
    room.delete(socket.id);
    socket.leave(voiceChannelRoom(channelId));
    io.to(voiceChannelRoom(channelId)).emit("voice:peer-left", { socketId: socket.id });
    io.to(voiceChannelRoom(channelId)).emit("voice:roster", voiceRoster(channelId));
    socket.data.currentVoiceChannelId = null;
  }

  function leaveCurrentChannel(socket) {
    if (!socket.data.currentChannelId) return;
    socket.leave(channelRoom(socket.data.currentChannelId));
    socket.data.currentChannelId = null;
  }

  function leaveCurrentGuild(socket) {
    const guildId = socket.data.currentGuildId;
    leaveVoiceChannel(socket);
    leaveCurrentChannel(socket);
    if (!guildId) return;
    online.get(guildId)?.delete(socket.id);
    io.to(guildRoom(guildId)).emit("presence:update", onlineList(guildId));
    socket.leave(guildRoom(guildId));
    socket.data.currentGuildId = null;
    socket.data.isGuildOwner = false;
  }

  io.on("connection", (socket) => {
    safeOn(socket, "auth", async ({ nickname, password, sessionToken }, ack) => {
      try {
        let user;

        if (sessionToken) {
          // reconectando com o token que ganhou no login anterior — sem
          // precisar digitar a senha de novo, enquanto o servidor não reiniciar
          const session = sessions.get(sessionToken);
          user = session && (await findUserById(session.userId));
          if (!user) {
            ack?.({ ok: false, error: "Sessão expirada, entra de novo.", needsPassword: true });
            return;
          }
        } else {
          const cleanNickname = String(nickname || "")
            .trim()
            .slice(0, MAX_NICKNAME_LEN);
          if (!cleanNickname) {
            ack?.({ ok: false, error: "Apelido inválido." });
            return;
          }
          if (!password || password.length < MIN_PASSWORD_LEN) {
            ack?.({
              ok: false,
              error: `Senha precisa ter pelo menos ${MIN_PASSWORD_LEN} caracteres.`,
              needsPassword: true,
            });
            return;
          }

          const existing = await findUserByNickname(cleanNickname);
          if (!existing) {
            // apelido livre — cria a conta com essa senha
            const id = uuidv4();
            await createUser(id, cleanNickname, hashPassword(password));
            user = { id, nickname: cleanNickname };
          } else if (!existing.password_hash) {
            // conta de antes desse recurso existir: quem chegar primeiro
            // com uma senha passa a ser dono dela dali pra frente
            await setPasswordHash(existing.id, hashPassword(password));
            user = existing;
          } else if (verifyPassword(password, existing.password_hash)) {
            user = existing;
          } else {
            ack?.({ ok: false, error: "Senha incorreta.", needsPassword: true });
            return;
          }
        }

        await touchLastSeen(user.id);
        const isAdmin = isAdminNickname(user.nickname);

        socket.data.userId = user.id;
        socket.data.nickname = user.nickname;
        socket.data.isAdmin = isAdmin;
        socket.data.currentGuildId = null;
        socket.data.currentChannelId = null;
        socket.data.currentVoiceChannelId = null;
        socket.data.isGuildOwner = false;
        socket.data.messageTimestamps = [];

        // ninguém fica sem servidor nenhum: quem não é membro de nada
        // (conta nova, ou de antes de servidores existirem) entra no Geral
        let guilds = await getGuildsForUser(user.id);
        if (guilds.length === 0) {
          await addGuildMember(DEFAULT_GUILD_ID, user.id);
          guilds = await getGuildsForUser(user.id);
        }

        if (!userSockets.has(user.id)) userSockets.set(user.id, new Set());
        userSockets.get(user.id).add(socket.id);

        const [friends, incomingRequests, outgoingRequests] = await Promise.all([
          getFriends(user.id),
          getIncomingRequests(user.id),
          getOutgoingRequests(user.id),
        ]);

        // reconectando com token existente, reaproveita o mesmo — mintar um
        // novo a cada reconexão (rede cai, aba dorme, socket.io reconecta
        // sozinho) deixava a tabela de sessões crescer sem limite, com token
        // velho nunca invalidado. Só gera token novo em login de verdade.
        const activeSessionToken = sessionToken && sessions.has(sessionToken) ? sessionToken : uuidv4();
        sessions.set(activeSessionToken, { userId: user.id, nickname: user.nickname });

        ack?.({
          ok: true,
          userId: user.id,
          nickname: user.nickname,
          isAdmin,
          sessionToken: activeSessionToken,
          guilds,
          friends: friends.map((f) => ({ ...f, online: isUserOnline(f.id) })),
          incomingRequests,
          outgoingRequests,
        });
      } catch (err) {
        console.error("auth failed", err);
        ack?.({ ok: false, error: "Falha ao entrar. Tente de novo." });
      }
    });

    // --- servidores (guilds) ---

    safeOn(socket, "guild:switch", async ({ guildId } = {}, ack) => {
      if (!socket.data.userId || !guildId) return;
      // se dois guild:switch forem disparados em sequência rápida (clique
      // duplo, etc.), sem isso o primeiro podia terminar depois do segundo
      // e sobrescrever qual servidor o socket realmente ficou — cada
      // chamada carrega um número, e só quem for o mais recente ao final
      // de cada await é que mexe no estado.
      const requestId = (socket.data.switchGeneration = (socket.data.switchGeneration || 0) + 1);
      const isStale = () => socket.data.switchGeneration !== requestId;
      try {
        if (!(await isGuildMember(guildId, socket.data.userId))) {
          ack?.({ ok: false, error: "Você não é membro desse servidor." });
          return;
        }
        if (await isBanned(guildId, socket.data.userId)) {
          ack?.({ ok: false, error: "Você foi banido deste servidor." });
          return;
        }
        if (isStale()) return;

        leaveCurrentGuild(socket);

        const guild = await getGuildById(guildId);
        if (isStale()) return;
        socket.data.currentGuildId = guildId;
        socket.data.isGuildOwner = guild?.owner_id === socket.data.userId;
        socket.join(guildRoom(guildId));

        if (!online.has(guildId)) online.set(guildId, new Map());
        online.get(guildId).set(socket.id, {
          userId: socket.data.userId,
          nickname: socket.data.nickname,
          isAdmin: socket.data.isAdmin,
        });

        const channels = await getChannelsForGuild(guildId);
        if (isStale()) return;
        const firstText = channels.find((c) => c.type === "text");

        let history = [];
        if (firstText) {
          socket.data.currentChannelId = firstText.id;
          socket.join(channelRoom(firstText.id));
          history = await getRecentMessages(firstText.id, 50);
          if (isStale()) return;
        }

        ack?.({
          ok: true,
          channels,
          currentChannelId: firstText?.id || null,
          history,
          isGuildOwner: socket.data.isGuildOwner,
        });
        io.to(guildRoom(guildId)).emit("presence:update", onlineList(guildId));
      } catch (err) {
        console.error("guild:switch failed", err);
        ack?.({ ok: false, error: "Falha ao trocar de servidor." });
      }
    });

    safeOn(socket, "guild:create", async ({ name }, ack) => {
      if (!socket.data.userId) return;
      const cleanName = String(name || "").trim().slice(0, MAX_GUILD_NAME_LEN);
      if (!cleanName) {
        ack?.({ ok: false, error: "Nome do servidor não pode ficar vazio." });
        return;
      }
      try {
        const id = uuidv4();
        await createGuild(id, cleanName, socket.data.userId);
        await addGuildMember(id, socket.data.userId);
        await createChannel(uuidv4(), id, "geral", "text", null, 0);
        await createChannel(uuidv4(), id, "Geral", "voice", null, 0);
        const code = generateInviteCode();
        await createInvite(code, id, socket.data.userId);
        ack?.({
          ok: true,
          guild: { id, name: cleanName, owner_id: socket.data.userId },
          inviteCode: code,
        });
      } catch (err) {
        console.error("guild:create failed", err);
        ack?.({ ok: false, error: "Falha ao criar servidor." });
      }
    });

    safeOn(socket, "guild:join", async ({ inviteCode }, ack) => {
      if (!socket.data.userId) return;
      try {
        const code = String(inviteCode || "").trim().toUpperCase();
        const invite = code && (await getInvite(code));
        if (!invite) {
          ack?.({ ok: false, error: "Convite inválido." });
          return;
        }
        if (await isBanned(invite.guild_id, socket.data.userId)) {
          ack?.({ ok: false, error: "Você foi banido deste servidor." });
          return;
        }
        await addGuildMember(invite.guild_id, socket.data.userId);
        const guild = await getGuildById(invite.guild_id);
        ack?.({ ok: true, guild });
      } catch (err) {
        console.error("guild:join failed", err);
        ack?.({ ok: false, error: "Falha ao entrar no servidor." });
      }
    });

    safeOn(socket, "guild:invite", async ({ guildId }, ack) => {
      if (!socket.data.userId || !guildId) return;
      try {
        if (!(await isGuildMember(guildId, socket.data.userId))) {
          ack?.({ ok: false, error: "Você não é membro desse servidor." });
          return;
        }
        let invite = await getInviteForGuild(guildId);
        if (!invite) {
          const code = generateInviteCode();
          await createInvite(code, guildId, socket.data.userId);
          invite = { code };
        }
        ack?.({ ok: true, code: invite.code });
      } catch (err) {
        console.error("guild:invite failed", err);
        ack?.({ ok: false, error: "Falha ao gerar convite." });
      }
    });

    // --- canais: trocar de canal de texto, criar/apagar (dono/admin) ---

    safeOn(socket, "channel:switch", async ({ channelId }, ack) => {
      if (!socket.data.userId || !channelId) return;
      try {
        const channel = await getChannelById(channelId);
        if (!channel || channel.guild_id !== socket.data.currentGuildId || channel.type !== "text") {
          ack?.({ ok: false, error: "Canal inválido." });
          return;
        }
        leaveCurrentChannel(socket);
        socket.data.currentChannelId = channelId;
        socket.join(channelRoom(channelId));
        const history = await getRecentMessages(channelId, 50);
        ack?.({ ok: true, history });
      } catch (err) {
        console.error("channel:switch failed", err);
        ack?.({ ok: false, error: "Falha ao trocar de canal." });
      }
    });

    safeOn(socket, "channel:create", async ({ name, type, category }, ack) => {
      const guildId = socket.data.currentGuildId;
      const canManage = socket.data.isAdmin || socket.data.isGuildOwner;
      if (!canManage || !guildId) {
        ack?.({ ok: false, error: "Só o dono do servidor cria canais." });
        return;
      }
      const cleanType = type === "voice" ? "voice" : "text";
      const cleanName = sanitizeChannelName(cleanType, name);
      if (!cleanName) {
        ack?.({ ok: false, error: "Nome do canal não pode ficar vazio." });
        return;
      }
      try {
        const id = uuidv4();
        const cleanCategory = String(category || "").trim().slice(0, 40) || null;
        await createChannel(id, guildId, cleanName, cleanType, cleanCategory, 0);
        const channel = { id, guild_id: guildId, category: cleanCategory, name: cleanName, type: cleanType, position: 0 };
        io.to(guildRoom(guildId)).emit("channel:created", channel);
        ack?.({ ok: true, channel });
      } catch (err) {
        console.error("channel:create failed", err);
        ack?.({ ok: false, error: "Falha ao criar canal." });
      }
    });

    safeOn(socket, "channel:delete", async ({ channelId }, ack) => {
      const guildId = socket.data.currentGuildId;
      const canManage = socket.data.isAdmin || socket.data.isGuildOwner;
      if (!canManage || !guildId || !channelId) return;
      try {
        await deleteChannel(channelId, guildId);
        io.to(guildRoom(guildId)).emit("channel:deleted", { id: channelId });
        ack?.({ ok: true });
      } catch (err) {
        console.error("channel:delete failed", err);
        ack?.({ ok: false, error: "Falha ao apagar canal." });
      }
    });

    // --- webhooks: postam no canal que a pessoa está vendo agora ---
    safeOn(socket, "webhook:create", async ({ name }, ack) => {
      const guildId = socket.data.currentGuildId;
      const channelId = socket.data.currentChannelId;
      const canManage = socket.data.isAdmin || socket.data.isGuildOwner;
      if (!canManage || !guildId || !channelId) {
        ack?.({ ok: false, error: "Só o dono do servidor cria webhooks." });
        return;
      }
      try {
        const cleanName = String(name || "Webhook").trim().slice(0, 40) || "Webhook";
        const id = uuidv4();
        const token = crypto.randomBytes(24).toString("base64url");
        await createWebhook(id, token, guildId, channelId, cleanName, socket.data.userId);
        ack?.({ ok: true, webhook: { id, token, name: cleanName } });
      } catch (err) {
        console.error("webhook:create failed", err);
        ack?.({ ok: false, error: "Falha ao criar webhook." });
      }
    });

    safeOn(socket, "webhook:list", async (_payload, ack) => {
      const guildId = socket.data.currentGuildId;
      const canManage = socket.data.isAdmin || socket.data.isGuildOwner;
      if (!canManage || !guildId) {
        ack?.({ ok: false, error: "Só o dono do servidor vê os webhooks." });
        return;
      }
      try {
        const webhooks = await getWebhooksForGuild(guildId);
        ack?.({ ok: true, webhooks });
      } catch (err) {
        console.error("webhook:list failed", err);
        ack?.({ ok: false, error: "Falha ao listar webhooks." });
      }
    });

    safeOn(socket, "webhook:delete", async ({ id } = {}, ack) => {
      const guildId = socket.data.currentGuildId;
      const canManage = socket.data.isAdmin || socket.data.isGuildOwner;
      if (!canManage || !guildId || !id) return;
      try {
        await deleteWebhook(id, guildId);
        ack?.({ ok: true });
      } catch (err) {
        console.error("webhook:delete failed", err);
        ack?.({ ok: false, error: "Falha ao apagar webhook." });
      }
    });

    // --- chat (escopado ao canal que o socket está vendo agora) ---

    safeOn(socket, "chat:message", async (content) => {
      const guildId = socket.data.currentGuildId;
      const channelId = socket.data.currentChannelId;
      if (!socket.data.userId || !guildId || !channelId) return;

      const now = Date.now();
      socket.data.messageTimestamps = (socket.data.messageTimestamps || []).filter(
        (t) => now - t < RATE_LIMIT_WINDOW_MS
      );
      if (socket.data.messageTimestamps.length >= RATE_LIMIT_MAX) {
        socket.emit("chat:system", {
          text: "Você está mandando mensagem rápido demais — espera uns segundos.",
        });
        return;
      }

      const trimmed = String(content || "")
        .trim()
        .slice(0, MAX_MESSAGE_LEN);
      if (!trimmed) return;
      socket.data.messageTimestamps.push(now);

      try {
        const msg = await insertMessage(guildId, channelId, socket.data.userId, socket.data.nickname, trimmed);
        io.to(channelRoom(channelId)).emit("chat:message", msg);
      } catch (err) {
        console.error("failed to save message", err);
      }
    });

    safeOn(socket, "chat:delete", async (messageId) => {
      if (!socket.data.userId) return;
      try {
        const message = await getMessageById(messageId);
        // só apaga o que está no servidor que a pessoa está vendo agora
        if (!message || message.guild_id !== socket.data.currentGuildId) return;
        const isOwner = message.user_id === socket.data.userId;
        const canModerate = socket.data.isAdmin || socket.data.isGuildOwner;
        if (!isOwner && !canModerate) return;

        await deleteMessage(messageId);
        io.to(channelRoom(message.channel_id)).emit("chat:message-deleted", { id: messageId });

        if (!isOwner) {
          await addAuditLog(
            message.guild_id,
            socket.data.nickname,
            "delete_message",
            message.nickname,
            message.content.slice(0, 200)
          );
        }
      } catch (err) {
        console.error("failed to delete message", err);
      }
    });

    // --- moderação: admin global ou dono do servidor atual ---
    safeOn(socket, "mod:kick", async ({ userId: targetUserId } = {}) => {
      const guildId = socket.data.currentGuildId;
      const canModerate = socket.data.isAdmin || socket.data.isGuildOwner;
      if (!canModerate || !guildId || !targetUserId || targetUserId === socket.data.userId) return;

      // apelido e status de admin vêm do próprio socket alvo, nunca do que
      // o cliente que pediu o kick mandou — senão dava pra forjar um
      // "nickname" qualquer e derrubar um admin de verdade.
      const targets = socketsInGuild(guildId, targetUserId);
      if (targets.length === 0) return;
      if (targets.some((t) => t.data.isAdmin)) return; // admin não expulsa admin
      const targetNickname = targets[0].data.nickname;

      await addAuditLog(guildId, socket.data.nickname, "kick", targetNickname);
      io.to(guildRoom(guildId)).emit("chat:system", {
        text: `👢 ${targetNickname} foi expulso por ${socket.data.nickname}.`,
      });
      targets.forEach((t) => {
        t.emit("mod:kicked");
        t.disconnect(true);
      });
    });

    safeOn(socket, "mod:ban", async ({ userId: targetUserId } = {}) => {
      const guildId = socket.data.currentGuildId;
      const canModerate = socket.data.isAdmin || socket.data.isGuildOwner;
      if (!canModerate || !guildId || !targetUserId || targetUserId === socket.data.userId) return;

      // banido pode estar offline, então o alvo pode não ter socket — busca
      // o apelido real da conta no banco, nunca o que o cliente mandou.
      const targetUser = await findUserById(targetUserId);
      if (!targetUser) return;
      if (isAdminNickname(targetUser.nickname)) return; // admin não bane admin

      await banUser(guildId, targetUserId, socket.data.nickname);
      await addAuditLog(guildId, socket.data.nickname, "ban", targetUser.nickname);
      io.to(guildRoom(guildId)).emit("chat:system", {
        text: `🔨 ${targetUser.nickname} foi banido por ${socket.data.nickname}.`,
      });
      socketsInGuild(guildId, targetUserId).forEach((t) => {
        t.emit("mod:banned");
        t.disconnect(true);
      });
    });

    // --- sinalização WebRTC para a chamada de voz/vídeo em malha (mesh) ---
    // Quem entra por último é quem inicia a conexão com cada participante
    // já presente — evita os dois lados oferecendo ao mesmo tempo.
    safeOn(socket, "voice:join", async ({ channelId }) => {
      if (!socket.data.userId || !channelId) return;
      const channel = await getChannelById(channelId);
      if (!channel || channel.guild_id !== socket.data.currentGuildId || channel.type !== "voice") return;

      if (socket.data.currentVoiceChannelId && socket.data.currentVoiceChannelId !== channelId) {
        leaveVoiceChannel(socket);
      }

      if (!voiceRoom.has(channelId)) voiceRoom.set(channelId, new Map());
      const room = voiceRoom.get(channelId);
      const existingPeers = [...room.entries()].map(([socketId, v]) => ({ socketId, ...v }));
      room.set(socket.id, { userId: socket.data.userId, nickname: socket.data.nickname });
      socket.data.currentVoiceChannelId = channelId;
      socket.join(voiceChannelRoom(channelId));
      socket.emit("voice:existing-peers", existingPeers);
      socket.to(voiceChannelRoom(channelId)).emit("voice:roster", voiceRoster(channelId));
    });

    safeOn(socket, "voice:signal", ({ to, description, candidate } = {}) => {
      const channelId = socket.data.currentVoiceChannelId;
      if (!socket.data.userId || !to || !channelId) return;
      // só repassa sinal pra alguém que está de fato no mesmo canal de voz —
      // sem isso, qualquer socket que descobrisse um id de outro conseguiria
      // injetar oferta/candidato falso numa chamada alheia.
      const room = io.sockets.adapter.rooms.get(voiceChannelRoom(channelId));
      if (!room || !room.has(to)) return;
      io.to(to).emit("voice:signal", {
        from: socket.id,
        nickname: socket.data.nickname,
        description,
        candidate,
      });
    });

    // Só um repasse de estado pra UI (quem tá compartilhando a tela agora) —
    // a faixa de vídeo em si viaja pela sinalização voice:signal acima.
    safeOn(socket, "voice:screen-share", ({ sharing }) => {
      const channelId = socket.data.currentVoiceChannelId;
      if (!channelId) return;
      socket.to(voiceChannelRoom(channelId)).emit("voice:screen-share", {
        socketId: socket.id,
        sharing: !!sharing,
      });
    });

    safeOn(socket, "voice:leave", () => leaveVoiceChannel(socket));

    safeOn(socket, "disconnect", () => {
      leaveCurrentGuild(socket);
      if (socket.data.userId) {
        const set = userSockets.get(socket.data.userId);
        set?.delete(socket.id);
        if (set && set.size === 0) userSockets.delete(socket.data.userId);
      }
    });

    // --- amigos ---

    safeOn(socket, "friend:request", async ({ nickname }, ack) => {
      if (!socket.data.userId) return;
      try {
        const target = await findUserByNickname(String(nickname || "").trim());
        if (!target) {
          ack?.({ ok: false, error: "Apelido não encontrado." });
          return;
        }
        if (target.id === socket.data.userId) {
          ack?.({ ok: false, error: "Você não pode adicionar a si mesmo." });
          return;
        }
        const existing = await getFriendshipEither(socket.data.userId, target.id);
        if (existing?.status === "accepted") {
          ack?.({ ok: false, error: "Vocês já são amigos." });
          return;
        }
        if (existing?.status === "pending") {
          if (existing.requester_id === socket.data.userId) {
            ack?.({ ok: false, error: "Pedido já enviado, só esperar." });
            return;
          }
          // a outra pessoa já tinha te chamado — vira amigo na hora
          await acceptFriendRequest(existing.requester_id, existing.addressee_id);
          emitToUser(target.id, "friend:accepted", {
            id: socket.data.userId,
            nickname: socket.data.nickname,
          });
          ack?.({
            ok: true,
            status: "accepted",
            friend: { id: target.id, nickname: target.nickname },
          });
          return;
        }
        await createFriendRequest(socket.data.userId, target.id);
        emitToUser(target.id, "friend:request-received", {
          id: socket.data.userId,
          nickname: socket.data.nickname,
        });
        ack?.({ ok: true, status: "pending" });
      } catch (err) {
        console.error("friend:request failed", err);
        ack?.({ ok: false, error: "Falha ao enviar pedido." });
      }
    });

    safeOn(socket, "friend:accept", async ({ userId: requesterId } = {}, ack) => {
      if (!socket.data.userId || !requesterId) return;
      try {
        // confirma que existe mesmo um pedido pendente vindo dessa pessoa —
        // sem isso, um userId qualquer (inventado ou de quem nunca pediu)
        // ainda voltava com ok:true e friend:null, que quebrava o modal.
        const existing = await getFriendshipEither(requesterId, socket.data.userId);
        if (!existing || existing.status !== "pending" || existing.requester_id !== requesterId) {
          ack?.({ ok: false, error: "Esse pedido de amizade não existe (mais)." });
          return;
        }
        const requester = await findUserById(requesterId);
        if (!requester) {
          ack?.({ ok: false, error: "Essa conta não existe mais." });
          return;
        }
        await acceptFriendRequest(requesterId, socket.data.userId);
        emitToUser(requesterId, "friend:accepted", {
          id: socket.data.userId,
          nickname: socket.data.nickname,
        });
        ack?.({
          ok: true,
          friend: { id: requester.id, nickname: requester.nickname, online: isUserOnline(requester.id) },
        });
      } catch (err) {
        console.error("friend:accept failed", err);
        ack?.({ ok: false, error: "Falha ao aceitar." });
      }
    });

    safeOn(socket, "friend:decline", async ({ userId: otherId } = {}, ack) => {
      if (!socket.data.userId || !otherId) return;
      try {
        await deleteFriendshipEither(socket.data.userId, otherId);
        ack?.({ ok: true });
      } catch (err) {
        console.error("friend:decline failed", err);
        ack?.({ ok: false, error: "Falha ao recusar." });
      }
    });

    safeOn(socket, "friend:remove", async ({ userId: otherId } = {}, ack) => {
      if (!socket.data.userId || !otherId) return;
      try {
        await deleteFriendshipEither(socket.data.userId, otherId);
        emitToUser(otherId, "friend:removed", { id: socket.data.userId });
        ack?.({ ok: true });
      } catch (err) {
        console.error("friend:remove failed", err);
        ack?.({ ok: false, error: "Falha ao desfazer amizade." });
      }
    });

    safeOn(socket, "friend:list", async (_payload, ack) => {
      if (!socket.data.userId) return;
      try {
        const [friends, incomingRequests, outgoingRequests] = await Promise.all([
          getFriends(socket.data.userId),
          getIncomingRequests(socket.data.userId),
          getOutgoingRequests(socket.data.userId),
        ]);
        ack?.({
          ok: true,
          friends: friends.map((f) => ({ ...f, online: isUserOnline(f.id) })),
          incomingRequests,
          outgoingRequests,
        });
      } catch (err) {
        console.error("friend:list failed", err);
        ack?.({ ok: false, error: "Falha ao carregar amigos." });
      }
    });

    safeOn(socket, "friend:invite-to-guild", async ({ friendId, guildId }, ack) => {
      if (!socket.data.userId || !friendId || !guildId) return;
      try {
        const friendship = await getFriendshipEither(socket.data.userId, friendId);
        if (friendship?.status !== "accepted") {
          ack?.({ ok: false, error: "Vocês precisam ser amigos primeiro." });
          return;
        }
        if (!(await isGuildMember(guildId, socket.data.userId))) {
          ack?.({ ok: false, error: "Você não é membro desse servidor." });
          return;
        }
        if (await isBanned(guildId, friendId)) {
          ack?.({ ok: false, error: "Essa pessoa está banida desse servidor." });
          return;
        }
        await addGuildMember(guildId, friendId);
        const guild = await getGuildById(guildId);
        emitToUser(friendId, "guild:added", guild);
        ack?.({ ok: true });
      } catch (err) {
        console.error("friend:invite-to-guild failed", err);
        ack?.({ ok: false, error: "Falha ao convidar." });
      }
    });
  });
}
