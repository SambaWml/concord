import { v4 as uuidv4 } from "uuid";
import {
  findUserByNickname,
  findUserById,
  createUser,
  setPasswordHash,
  touchLastSeen,
  insertMessage,
  getRecentMessages,
  getMessageById,
  deleteMessage,
  isBanned,
  banUser,
  addAuditLog,
} from "./db.js";
import { hashPassword, verifyPassword } from "./auth.js";

const MAX_NICKNAME_LEN = 24;
const MAX_MESSAGE_LEN = 2000;
const MIN_PASSWORD_LEN = 4;
const RATE_LIMIT_MAX = 5; // mensagens...
const RATE_LIMIT_WINDOW_MS = 10_000; // ...por 10 segundos

// "admin" continua sendo uma lista de apelidos de confiança por variável de
// ambiente — mas agora que apelido tem dono (nickname + senha), só quem
// sabe a senha da conta consegue efetivamente entrar com esse nome.
const ADMIN_NICKNAMES = new Set(
  (process.env.ADMIN_NICKNAMES || "")
    .split(",")
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean)
);
const isAdminNickname = (nickname) => ADMIN_NICKNAMES.has(String(nickname || "").toLowerCase());

export function attachSocket(io) {
  // Estado em memória (não precisa persistir): quem está online e quem está
  // no canal de voz agora. Se o servidor reiniciar, todo mundo reconecta e
  // essas listas se refazem sozinhas — só o histórico de mensagens, bans e
  // audit log é que precisam sobreviver, e esses vão pro banco.
  const online = new Map(); // socket.id -> { userId, nickname, isAdmin }
  const voiceRoom = new Map(); // socket.id -> { userId, nickname }
  // Token de sessão em memória — some se o servidor reiniciar, aí a pessoa
  // só precisa digitar a senha de novo (não perde a conta, só a sessão).
  const sessions = new Map(); // sessionToken -> { userId, nickname }

  const onlineList = () => [...online.values()];
  const voiceRoster = () =>
    [...voiceRoom.entries()].map(([socketId, v]) => ({ socketId, ...v }));

  const socketsOf = (targetUserId) =>
    [...io.sockets.sockets.values()].filter((s) => s.data.userId === targetUserId);

  function leaveVoice(socket) {
    if (!voiceRoom.has(socket.id)) return;
    voiceRoom.delete(socket.id);
    io.emit("voice:peer-left", { socketId: socket.id });
    io.emit("voice:roster", voiceRoster());
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

        if (await isBanned(user.id)) {
          ack?.({ ok: false, error: "Você foi banido deste servidor." });
          return;
        }

        await touchLastSeen(user.id);
        const isAdmin = isAdminNickname(user.nickname);

        socket.data.userId = user.id;
        socket.data.nickname = user.nickname;
        socket.data.isAdmin = isAdmin;
        socket.data.messageTimestamps = [];
        online.set(socket.id, { userId: user.id, nickname: user.nickname, isAdmin });

        const newSessionToken = uuidv4();
        sessions.set(newSessionToken, { userId: user.id, nickname: user.nickname });

        const history = await getRecentMessages(50);
        ack?.({
          ok: true,
          userId: user.id,
          nickname: user.nickname,
          isAdmin,
          sessionToken: newSessionToken,
          history,
        });
        io.emit("presence:update", onlineList());
      } catch (err) {
        console.error("auth failed", err);
        ack?.({ ok: false, error: "Falha ao entrar. Tente de novo." });
      }
    });

    socket.on("chat:message", async (content) => {
      if (!socket.data.userId) return;

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
        const msg = await insertMessage(socket.data.userId, socket.data.nickname, trimmed);
        io.emit("chat:message", msg);
      } catch (err) {
        console.error("failed to save message", err);
      }
    });

    socket.on("chat:delete", async (messageId) => {
      if (!socket.data.userId) return;
      try {
        const message = await getMessageById(messageId);
        if (!message) return;
        const isOwner = message.user_id === socket.data.userId;
        if (!isOwner && !socket.data.isAdmin) return;

        await deleteMessage(messageId);
        io.emit("chat:message-deleted", { id: messageId });

        if (!isOwner) {
          await addAuditLog(
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

    // --- moderação: só quem está na lista ADMIN_NICKNAMES pode usar ---
    socket.on("mod:kick", async ({ userId: targetUserId, nickname: targetNickname }) => {
      if (!socket.data.isAdmin || !targetUserId || targetUserId === socket.data.userId) return;
      if (isAdminNickname(targetNickname)) return; // admin não expulsa admin

      const targets = socketsOf(targetUserId);
      if (targets.length === 0) return;

      await addAuditLog(socket.data.nickname, "kick", targetNickname);
      io.emit("chat:system", {
        text: `👢 ${targetNickname} foi expulso por ${socket.data.nickname}.`,
      });
      targets.forEach((t) => {
        t.emit("mod:kicked");
        t.disconnect(true);
      });
    });

    socket.on("mod:ban", async ({ userId: targetUserId, nickname: targetNickname }) => {
      if (!socket.data.isAdmin || !targetUserId || targetUserId === socket.data.userId) return;
      if (isAdminNickname(targetNickname)) return; // admin não bane admin

      await banUser(targetUserId, socket.data.nickname);
      await addAuditLog(socket.data.nickname, "ban", targetNickname);
      io.emit("chat:system", {
        text: `🔨 ${targetNickname} foi banido por ${socket.data.nickname}.`,
      });
      socketsOf(targetUserId).forEach((t) => {
        t.emit("mod:banned");
        t.disconnect(true);
      });
    });

    // --- sinalização WebRTC para a chamada de voz/vídeo em malha (mesh) ---
    // Quem entra por último é quem inicia a conexão com cada participante
    // já presente — evita os dois lados oferecendo ao mesmo tempo.
    socket.on("voice:join", () => {
      if (!socket.data.userId) return;
      const existingPeers = voiceRoster();
      voiceRoom.set(socket.id, {
        userId: socket.data.userId,
        nickname: socket.data.nickname,
      });
      socket.emit("voice:existing-peers", existingPeers);
      socket.broadcast.emit("voice:roster", voiceRoster());
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
      socket.broadcast.emit("voice:screen-share", {
        socketId: socket.id,
        sharing: !!sharing,
      });
    });

    socket.on("voice:leave", () => leaveVoice(socket));

    socket.on("disconnect", () => {
      online.delete(socket.id);
      leaveVoice(socket);
      io.emit("presence:update", onlineList());
    });
  });
}
