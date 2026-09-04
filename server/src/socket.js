import { v4 as uuidv4 } from "uuid";
import { upsertUser, insertMessage, getRecentMessages } from "./db.js";

const MAX_NICKNAME_LEN = 24;
const MAX_MESSAGE_LEN = 2000;

export function attachSocket(io) {
  // Estado em memória (não precisa persistir): quem está online e quem está
  // no canal de voz agora. Se o servidor reiniciar, todo mundo reconecta e
  // essas listas se refazem sozinhas — só o histórico de mensagens é que
  // precisa sobreviver, e esse vai pro Postgres.
  const online = new Map(); // socket.id -> { userId, nickname }
  const voiceRoom = new Map(); // socket.id -> { userId, nickname }

  const onlineList = () => [...online.values()];
  const voiceRoster = () =>
    [...voiceRoom.entries()].map(([socketId, v]) => ({ socketId, ...v }));

  function leaveVoice(socket) {
    if (!voiceRoom.has(socket.id)) return;
    voiceRoom.delete(socket.id);
    io.emit("voice:peer-left", { socketId: socket.id });
    io.emit("voice:roster", voiceRoster());
  }

  io.on("connection", (socket) => {
    socket.on("auth", async ({ userId, nickname }, ack) => {
      try {
        const cleanNickname = String(nickname || "")
          .trim()
          .slice(0, MAX_NICKNAME_LEN);
        if (!cleanNickname) {
          ack?.({ ok: false, error: "Apelido inválido." });
          return;
        }
        const id = userId || uuidv4();
        await upsertUser(id, cleanNickname);

        socket.data.userId = id;
        socket.data.nickname = cleanNickname;
        online.set(socket.id, { userId: id, nickname: cleanNickname });

        const history = await getRecentMessages(50);
        ack?.({ ok: true, userId: id, history });
        io.emit("presence:update", onlineList());
      } catch (err) {
        console.error("auth failed", err);
        ack?.({ ok: false, error: "Falha ao entrar. Tente de novo." });
      }
    });

    socket.on("chat:message", async (content) => {
      if (!socket.data.userId) return;
      const trimmed = String(content || "")
        .trim()
        .slice(0, MAX_MESSAGE_LEN);
      if (!trimmed) return;
      try {
        const msg = await insertMessage(
          socket.data.userId,
          socket.data.nickname,
          trimmed
        );
        io.emit("chat:message", msg);
      } catch (err) {
        console.error("failed to save message", err);
      }
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
