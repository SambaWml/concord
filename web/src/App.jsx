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

export default function App() {
  const [identity, setIdentity] = useState(loadIdentity);
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
        setMessages(res.history || []);
        setStatus("online");
      }
    );
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
    function onPresence(list) {
      setOnline(list);
    }
    function onDisconnect() {
      setStatus("offline");
    }
    function onConnect() {
      if (identity) setStatus("online");
    }

    socket.on("chat:message", onMessage);
    socket.on("presence:update", onPresence);
    socket.on("disconnect", onDisconnect);
    socket.on("connect", onConnect);

    return () => {
      socket.off("chat:message", onMessage);
      socket.off("presence:update", onPresence);
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onConnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  if (!identity) {
    return <Login onEnter={enter} error={error} />;
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
              {u.nickname}
            </div>
          ))}
        </div>

        <div className="me-bar">
          <span className={"status-dot status-dot--" + status} />
          {identity.nickname}
        </div>
      </aside>

      <main className="main-area">
        <VoicePanel socket={socket} myNickname={identity.nickname} />
        <Chat
          messages={messages}
          onSend={(text) => socket.emit("chat:message", text)}
          myNickname={identity.nickname}
        />
      </main>
    </div>
  );
}
