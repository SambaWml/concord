import { useEffect, useState } from "react";
import { socket } from "./socket.js";
import Login from "./components/Login.jsx";
import Chat from "./components/Chat.jsx";
import VoicePanel from "./components/VoicePanel.jsx";

const STORAGE_KEY = "concord:identity";

function loadIdentity() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function saveIdentity(identity) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

let systemMsgSeq = 0;

export default function App() {
  const [identity, setIdentity] = useState(loadIdentity);
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState("connecting"); // connecting | online | offline
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [online, setOnline] = useState([]);

  function enter(nickname) {
    setError("");
    socket.connect();
    socket.emit(
      "auth",
      { userId: identity?.userId, nickname },
      (res) => {
        if (!res?.ok) {
          setError(res?.error || "Não foi possível entrar.");
          socket.disconnect();
          return;
        }
        const next = { userId: res.userId, nickname };
        saveIdentity(next);
        setIdentity(next);
        setIsAdmin(!!res.isAdmin);
        setMessages(res.history || []);
        setStatus("online");
      }
    );
  }

  function forceLogout(reason) {
    socket.disconnect();
    setIdentity(null);
    setIsAdmin(false);
    setMessages([]);
    setOnline([]);
    setError(reason);
  }

  // reconecta sozinho se já tiver identidade salva
  useEffect(() => {
    if (identity) enter(identity.nickname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onMessage(msg) {
      setMessages((prev) => [...prev, msg]);
    }
    function onMessageDeleted({ id }) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
    function onSystem({ text }) {
      systemMsgSeq += 1;
      setMessages((prev) => [
        ...prev,
        { id: `sys-${systemMsgSeq}`, system: true, content: text, created_at: new Date().toISOString() },
      ]);
    }
    function onPresence(list) {
      setOnline(list);
    }
    function onDisconnect() {
      setStatus("offline");
    }
    function onConnect() {
      if (identity) setStatus("online");
    }
    function onKicked() {
      forceLogout("Você foi expulso do servidor.");
    }
    function onBanned() {
      forceLogout("Você foi banido deste servidor.");
    }

    socket.on("chat:message", onMessage);
    socket.on("chat:message-deleted", onMessageDeleted);
    socket.on("chat:system", onSystem);
    socket.on("presence:update", onPresence);
    socket.on("disconnect", onDisconnect);
    socket.on("connect", onConnect);
    socket.on("mod:kicked", onKicked);
    socket.on("mod:banned", onBanned);

    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:message-deleted", onMessageDeleted);
      socket.off("chat:system", onSystem);
      socket.off("presence:update", onPresence);
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onConnect);
      socket.off("mod:kicked", onKicked);
      socket.off("mod:banned", onBanned);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  if (!identity) {
    return <Login onEnter={enter} error={error} />;
  }

  function kick(user) {
    if (!window.confirm(`Expulsar ${user.nickname} do servidor?`)) return;
    socket.emit("mod:kick", { userId: user.userId, nickname: user.nickname });
  }

  function ban(user) {
    if (!window.confirm(`Banir ${user.nickname} permanentemente?`)) return;
    socket.emit("mod:ban", { userId: user.userId, nickname: user.nickname });
  }

  return (
    <div className="app">
      <aside className="server-rail">
        <div className="server-icon server-icon--active">C</div>
      </aside>

      <aside className="channel-list">
        <div className="channel-list-header">Concord — Geral</div>
        <div className="channel-group-label">Canais de texto</div>
        <div className="channel channel--active"># geral</div>
        <div className="channel-group-label">Canais de voz</div>
        <div className="channel">🔊 Geral</div>

        <div className="online-panel">
          <div className="channel-group-label">
            Online — {online.length}
          </div>
          {online.map((u) => (
            <div className="online-user" key={u.userId}>
              <span className="online-dot" />
              <span className="online-user-name">
                {u.isAdmin && "👑 "}
                {u.nickname}
              </span>
              {isAdmin && !u.isAdmin && u.userId !== identity.userId && (
                <span className="online-user-actions">
                  <button title="Expulsar" onClick={() => kick(u)}>
                    👢
                  </button>
                  <button title="Banir" onClick={() => ban(u)}>
                    🔨
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="me-bar">
          <span className={"status-dot status-dot--" + status} />
          {identity.nickname}
          {isAdmin && <span className="admin-badge">admin</span>}
        </div>
      </aside>

      <main className="main-area">
        <VoicePanel socket={socket} myNickname={identity.nickname} />
        <Chat
          messages={messages}
          onSend={(text) => socket.emit("chat:message", text)}
          onDelete={(id) => socket.emit("chat:delete", id)}
          myUserId={identity.userId}
          isAdmin={isAdmin}
        />
      </main>
    </div>
  );
}
