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

function generateInviteCode() {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += INVITE_ALPHABET[crypto.randomInt(INVITE_ALPHABET.length)];
  }
  return code;
}

export function attachSocket(io) {
  // Estado em memória, por servidor — some sozinho se o processo reiniciar,
  // e cada socket só aparece aqui enquanto estiver "olhando" aquele servidor
  // (guild:switch). Histórico, membros, convites e bans vão pro banco.
  const online = new Map(); // guildId -> Map<socket.id, {userId, nickname, isAdmin}>
  const voiceRoom = new Map(); // guildId -> Map<socket.id, {userId, nickname}>
  const sessions = new Map(); // sessionToken -> { userId, nickname }
  // Independe de servidor — pra notificar um amigo (pedido/aceite) não
  // importa em qual servidor ele esteja olhando agora, ou se está em nenhum.
  const userSockets = new Map(); // userId -> Set<socket.id>

  const onlineList = (guildId) => [...(online.get(guildId)?.values() || [])];
  const voiceRoster = (guildId) =>
    [...(voiceRoom.get(guildId)?.entries() || [])].map(([socketId, v]) => ({ socketId, ...v }));

  const isUserOnline = (userId) => (userSockets.get(userId)?.size || 0) > 0;
  function emitToUser(userId, event, payload) {
    for (const sid of userSockets.get(userId) || []) io.to(sid).emit(event, payload);
  }

  const socketsOf = (guildId, targetUserId) => {
    const room = io.sockets.adapter.rooms.get(guildId);
    if (!room) return [];
    return [...room]
      .map((id) => io.sockets.sockets.get(id))
      .filter((s) => s && s.data.userId === targetUserId);
  };

  function leaveVoice(socket, guildId) {
    const room = guildId && voiceRoom.get(guildId);
    if (!room || !room.has(socket.id)) return;
    room.delete(socket.id);
    io.to(guildId).emit("voice:peer-left", { socketId: socket.id });
    io.to(guildId).emit("voice:roster", voiceRoster(guildId));
  }

  function leaveCurrentGuild(socket) {
    const guildId = socket.data.currentGuildId;
    if (!guildId) return;
    leaveVoice(socket, guildId);
    online.get(guildId)?.delete(socket.id);
    io.to(guildId).emit("presence:update", onlineList(guildId));
    socket.leave(guildId);
    socket.data.currentGuildId = null;
  }

  io.on("connection", (socket) => {
    socket.on("auth", async ({ nickname, password, sessionToken }, ack) => {
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

        const newSessionToken = uuidv4();
        sessions.set(newSessionToken, { userId: user.id, nickname: user.nickname });

        ack?.({
          ok: true,
          userId: user.id,
          nickname: user.nickname,
          isAdmin,
          sessionToken: newSessionToken,
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

    socket.on("guild:switch", async ({ guildId }, ack) => {
      if (!socket.data.userId || !guildId) return;
      try {
        if (!(await isGuildMember(guildId, socket.data.userId))) {
          ack?.({ ok: false, error: "Você não é membro desse servidor." });
          return;
        }
        if (await isBanned(guildId, socket.data.userId)) {
          ack?.({ ok: false, error: "Você foi banido deste servidor." });
          return;
        }

        leaveCurrentGuild(socket);

        const guild = await getGuildById(guildId);
        socket.data.currentGuildId = guildId;
        socket.data.isGuildOwner = guild?.owner_id === socket.data.userId;
        socket.join(guildId);

        if (!online.has(guildId)) online.set(guildId, new Map());
        online.get(guildId).set(socket.id, {
          userId: socket.data.userId,
          nickname: socket.data.nickname,
          isAdmin: socket.data.isAdmin,
        });

        const history = await getRecentMessages(guildId, 50);
        ack?.({ ok: true, history, isGuildOwner: socket.data.isGuildOwner });
        io.to(guildId).emit("presence:update", onlineList(guildId));
      } catch (err) {
        console.error("guild:switch failed", err);
        ack?.({ ok: false, error: "Falha ao trocar de servidor." });
      }
    });

    socket.on("guild:create", async ({ name }, ack) => {
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

    socket.on("guild:join", async ({ inviteCode }, ack) => {
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

    socket.on("guild:invite", async ({ guildId }, ack) => {
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

    // --- webhooks: só dono do servidor atual ou admin global ---
    socket.on("webhook:create", async ({ name }, ack) => {
      const guildId = socket.data.currentGuildId;
      const canManage = socket.data.isAdmin || socket.data.isGuildOwner;
      if (!canManage || !guildId) {
        ack?.({ ok: false, error: "Só o dono do servidor cria webhooks." });
        return;
      }
      try {
        const cleanName = String(name || "Webhook").trim().slice(0, 40) || "Webhook";
        const id = uuidv4();
        const token = crypto.randomBytes(24).toString("base64url");
        await createWebhook(id, token, guildId, cleanName, socket.data.userId);
        ack?.({ ok: true, webhook: { id, token, name: cleanName } });
      } catch (err) {
        console.error("webhook:create failed", err);
        ack?.({ ok: false, error: "Falha ao criar webhook." });
      }
    });

    socket.on("webhook:list", async (_payload, ack) => {
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

    socket.on("webhook:delete", async ({ id }, ack) => {
      const guildId = socket.data.currentGuildId;
      const canManage = socket.data.isAdmin || socket.data.isGuildOwner;
      if (!canManage || !guildId || !id) return;
      await deleteWebhook(id, guildId);
      ack?.({ ok: true });
    });

    // --- chat (escopado ao servidor que o socket está vendo agora) ---

    socket.on("chat:message", async (content) => {
      const guildId = socket.data.currentGuildId;
      if (!socket.data.userId || !guildId) return;

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
        const msg = await insertMessage(guildId, socket.data.userId, socket.data.nickname, trimmed);
        io.to(guildId).emit("chat:message", msg);
      } catch (err) {
        console.error("failed to save message", err);
      }
    });

    socket.on("chat:delete", async (messageId) => {
      if (!socket.data.userId) return;
      try {
        const message = await getMessageById(messageId);
        // só apaga o que está no servidor que a pessoa está vendo agora
        if (!message || message.guild_id !== socket.data.currentGuildId) return;
        const isOwner = message.user_id === socket.data.userId;
        const canModerate = socket.data.isAdmin || socket.data.isGuildOwner;
        if (!isOwner && !canModerate) return;

        await deleteMessage(messageId);
        io.to(message.guild_id).emit("chat:message-deleted", { id: messageId });

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
    socket.on("mod:kick", async ({ userId: targetUserId, nickname: targetNickname }) => {
      const guildId = socket.data.currentGuildId;
      const canModerate = socket.data.isAdmin || socket.data.isGuildOwner;
      if (!canModerate || !guildId || !targetUserId || targetUserId === socket.data.userId) return;
      if (isAdminNickname(targetNickname)) return; // admin não expulsa admin

      const targets = socketsOf(guildId, targetUserId);
      if (targets.length === 0) return;

      await addAuditLog(guildId, socket.data.nickname, "kick", targetNickname);
      io.to(guildId).emit("chat:system", {
        text: `👢 ${targetNickname} foi expulso por ${socket.data.nickname}.`,
      });
      targets.forEach((t) => {
        t.emit("mod:kicked");
        t.disconnect(true);
      });
    });

    socket.on("mod:ban", async ({ userId: targetUserId, nickname: targetNickname }) => {
      const guildId = socket.data.currentGuildId;
      const canModerate = socket.data.isAdmin || socket.data.isGuildOwner;
      if (!canModerate || !guildId || !targetUserId || targetUserId === socket.data.userId) return;
      if (isAdminNickname(targetNickname)) return; // admin não bane admin

      await banUser(guildId, targetUserId, socket.data.nickname);
      await addAuditLog(guildId, socket.data.nickname, "ban", targetNickname);
      io.to(guildId).emit("chat:system", {
        text: `🔨 ${targetNickname} foi banido por ${socket.data.nickname}.`,
      });
      socketsOf(guildId, targetUserId).forEach((t) => {
        t.emit("mod:banned");
        t.disconnect(true);
      });
    });

    // --- sinalização WebRTC para a chamada de voz/vídeo em malha (mesh) ---
    // Quem entra por último é quem inicia a conexão com cada participante
    // já presente — evita os dois lados oferecendo ao mesmo tempo.
    socket.on("voice:join", () => {
      const guildId = socket.data.currentGuildId;
      if (!socket.data.userId || !guildId) return;
      if (!voiceRoom.has(guildId)) voiceRoom.set(guildId, new Map());
      const room = voiceRoom.get(guildId);
      const existingPeers = [...room.entries()].map(([socketId, v]) => ({ socketId, ...v }));
      room.set(socket.id, { userId: socket.data.userId, nickname: socket.data.nickname });
      socket.emit("voice:existing-peers", existingPeers);
      socket.to(guildId).emit("voice:roster", voiceRoster(guildId));
    });

    socket.on("voice:signal", ({ to, description, candidate }) => {
      if (!to) return;
      io.to(to).emit("voice:signal", {
        from: socket.id,
        nickname: socket.data.nickname,
        description,
        candidate,
      });
    });

    // Só um repasse de estado pra UI (quem tá compartilhando a tela agora) —
    // a faixa de vídeo em si viaja pela sinalização voice:signal acima.
    socket.on("voice:screen-share", ({ sharing }) => {
      const guildId = socket.data.currentGuildId;
      if (!guildId) return;
      socket.to(guildId).emit("voice:screen-share", {
        socketId: socket.id,
        sharing: !!sharing,
      });
    });

    socket.on("voice:leave", () => leaveVoice(socket, socket.data.currentGuildId));

    socket.on("disconnect", () => {
      leaveCurrentGuild(socket);
      if (socket.data.userId) {
        const set = userSockets.get(socket.data.userId);
        set?.delete(socket.id);
        if (set && set.size === 0) userSockets.delete(socket.data.userId);
      }
    });

    // --- amigos ---

    socket.on("friend:request", async ({ nickname }, ack) => {
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

    socket.on("friend:accept", async ({ userId: requesterId }, ack) => {
      if (!socket.data.userId || !requesterId) return;
      try {
        await acceptFriendRequest(requesterId, socket.data.userId);
        const requester = await findUserById(requesterId);
        emitToUser(requesterId, "friend:accepted", {
          id: socket.data.userId,
          nickname: socket.data.nickname,
        });
        ack?.({
          ok: true,
          friend: requester
            ? { id: requester.id, nickname: requester.nickname, online: isUserOnline(requester.id) }
            : null,
        });
      } catch (err) {
        console.error("friend:accept failed", err);
        ack?.({ ok: false, error: "Falha ao aceitar." });
      }
    });

    socket.on("friend:decline", async ({ userId: otherId }, ack) => {
      if (!socket.data.userId || !otherId) return;
      await deleteFriendshipEither(socket.data.userId, otherId);
      ack?.({ ok: true });
    });

    socket.on("friend:remove", async ({ userId: otherId }, ack) => {
      if (!socket.data.userId || !otherId) return;
      await deleteFriendshipEither(socket.data.userId, otherId);
      emitToUser(otherId, "friend:removed", { id: socket.data.userId });
      ack?.({ ok: true });
    });

    socket.on("friend:list", async (_payload, ack) => {
      if (!socket.data.userId) return;
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
    });

    socket.on("friend:invite-to-guild", async ({ friendId, guildId }, ack) => {
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
