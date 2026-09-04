import { useEffect, useState } from "react";
import { socket } from "./socket.js";
import Login from "./components/Login.jsx";
import Chat from "./components/Chat.jsx";
import VoicePanel from "./components/VoicePanel.jsx";
import ServerModal from "./components/ServerModal.jsx";
import FriendsModal from "./components/FriendsModal.jsx";

const STORAGE_KEY = "concord:identity";
// guarda { userId, nickname, sessionToken, lastGuildId } — nunca a senha.

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

function emitAsync(event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

let systemMsgSeq = 0;

export default function App() {
  const [identity, setIdentity] = useState(loadIdentity);
  const [isAdmin, setIsAdmin] = useState(false);
  const [guilds, setGuilds] = useState([]);
  const [currentGuildId, setCurrentGuildId] = useState(null);
  const [isGuildOwner, setIsGuildOwner] = useState(false);
  const [status, setStatus] = useState("connecting"); // connecting | online | offline
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [online, setOnline] = useState([]);
  const [showServerModal, setShowServerModal] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [showWebhooks, setShowWebhooks] = useState(false);
  const [webhooks, setWebhooks] = useState([]);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);

  function applyAuthSuccess(res, previousIdentity) {
    const next = {
      userId: res.userId,
      nickname: res.nickname,
      sessionToken: res.sessionToken,
      lastGuildId: previousIdentity?.lastGuildId,
    };
    saveIdentity(next);
    setIdentity(next);
    setIsAdmin(!!res.isAdmin);
    setGuilds(res.guilds || []);
    setFriends(res.friends || []);
    setIncomingRequests(res.incomingRequests || []);
    setOutgoingRequests(res.outgoingRequests || []);
    setStatus("online");
    setError("");

    const wanted = res.guilds?.find((g) => g.id === previousIdentity?.lastGuildId);
    const target = wanted || res.guilds?.[0];
    if (target) switchGuild(target.id);
  }

  function backToLogin(reason, keepNickname) {
    socket.disconnect();
    setIdentity(keepNickname ? { nickname: keepNickname } : null);
    setIsAdmin(false);
    setGuilds([]);
    setCurrentGuildId(null);
    setMessages([]);
    setOnline([]);
    setInviteCode(null);
    setFriends([]);
    setIncomingRequests([]);
    setOutgoingRequests([]);
    setError(reason);
  }

  async function switchGuild(guildId) {
    if (!guildId) return;
    const res = await emitAsync("guild:switch", { guildId });
    if (!res?.ok) {
      setError(res?.error || "Não foi possível entrar nesse servidor.");
      return;
    }
    setCurrentGuildId(guildId);
    setIsGuildOwner(!!res.isGuildOwner);
    setMessages(res.history || []);
    setInviteCode(null);
    setIdentity((prev) => {
      const next = { ...prev, lastGuildId: guildId };
      saveIdentity(next);
      return next;
    });
  }

  function enter(nickname, password) {
    setError("");
    socket.connect();
    socket.emit("auth", { nickname, password }, (res) => {
      if (!res?.ok) {
        setError(res?.error || "Não foi possível entrar.");
        socket.disconnect();
        return;
      }
      applyAuthSuccess(res, identity);
    });
  }

  // com sessão salva, conecta sozinho — tanto na carga da página quanto em
  // qualquer reconexão depois de uma queda de rede (o socket.io reconecta
  // sozinho, mas precisa reautenticar de novo do lado do servidor).
  useEffect(() => {
    if (identity?.sessionToken) socket.connect();
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
      if (!identity?.sessionToken) return;
      socket.emit("auth", { sessionToken: identity.sessionToken }, (res) => {
        if (!res?.ok) {
          backToLogin(res?.error || "Sessão expirada, entra de novo.", identity.nickname);
          return;
        }
        applyAuthSuccess(res, identity);
      });
    }
    function onKicked() {
      backToLogin("Você foi expulso do servidor.");
    }
    function onBanned() {
      backToLogin("Você foi banido deste servidor.");
    }
    function onFriendRequestReceived(from) {
      setIncomingRequests((prev) =>
        prev.some((r) => r.id === from.id) ? prev : [...prev, from]
      );
    }
    function onFriendAccepted(friend) {
      setFriends((prev) => (prev.some((f) => f.id === friend.id) ? prev : [...prev, { ...friend, online: true }]));
      setOutgoingRequests((prev) => prev.filter((r) => r.id !== friend.id));
    }
    function onFriendRemoved({ id }) {
      setFriends((prev) => prev.filter((f) => f.id !== id));
    }
    function onGuildAdded(guild) {
      setGuilds((prev) => (prev.some((g) => g.id === guild.id) ? prev : [...prev, guild]));
      systemMsgSeq += 1;
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${systemMsgSeq}`,
          system: true,
          content: `Você foi adicionado ao servidor "${guild.name}".`,
          created_at: new Date().toISOString(),
        },
      ]);
    }

    socket.on("chat:message", onMessage);
    socket.on("chat:message-deleted", onMessageDeleted);
    socket.on("chat:system", onSystem);
    socket.on("presence:update", onPresence);
    socket.on("disconnect", onDisconnect);
    socket.on("connect", onConnect);
    socket.on("mod:kicked", onKicked);
    socket.on("mod:banned", onBanned);
    socket.on("friend:request-received", onFriendRequestReceived);
    socket.on("friend:accepted", onFriendAccepted);
    socket.on("friend:removed", onFriendRemoved);
    socket.on("guild:added", onGuildAdded);

    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:message-deleted", onMessageDeleted);
      socket.off("chat:system", onSystem);
      socket.off("presence:update", onPresence);
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onConnect);
      socket.off("mod:kicked", onKicked);
      socket.off("mod:banned", onBanned);
      socket.off("friend:request-received", onFriendRequestReceived);
      socket.off("friend:accepted", onFriendAccepted);
      socket.off("friend:removed", onFriendRemoved);
      socket.off("guild:added", onGuildAdded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  if (!identity?.sessionToken) {
    return <Login onEnter={enter} error={error} defaultNickname={identity?.nickname} />;
  }

  function kick(user) {
    if (!window.confirm(`Expulsar ${user.nickname} do servidor?`)) return;
    socket.emit("mod:kick", { userId: user.userId, nickname: user.nickname });
  }

  function ban(user) {
    if (!window.confirm(`Banir ${user.nickname} permanentemente?`)) return;
    socket.emit("mod:ban", { userId: user.userId, nickname: user.nickname });
  }

  async function toggleInvite() {
    if (inviteCode) {
      setInviteCode(null);
      return;
    }
    const res = await emitAsync("guild:invite", { guildId: currentGuildId });
    if (res?.ok) setInviteCode(res.code);
  }

  async function toggleWebhooks() {
    if (showWebhooks) {
      setShowWebhooks(false);
      return;
    }
    const res = await emitAsync("webhook:list", {});
    if (res?.ok) {
      setWebhooks(res.webhooks);
      setShowWebhooks(true);
    }
  }

  async function createWebhook() {
    const name = window.prompt("Nome do webhook (aparece como autor das mensagens):", "Webhook");
    if (!name) return;
    const res = await emitAsync("webhook:create", { name });
    if (res?.ok) {
      setWebhooks((prev) => [...prev, res.webhook]);
    }
  }

  async function removeWebhook(id) {
    if (!window.confirm("Apagar esse webhook? Quem tiver a URL para de conseguir postar.")) return;
    await emitAsync("webhook:delete", { id });
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  }

  function webhookUrl(w) {
    return `${window.location.origin}/api/webhooks/${w.id}/${w.token}`;
  }

  const canModerate = isAdmin || isGuildOwner;
  const currentGuild = guilds.find((g) => g.id === currentGuildId);

  return (
    <div className="app">
      <aside className="server-rail">
        <button
          className="server-icon server-icon--friends"
          title="Amigos"
          onClick={() => setShowFriendsModal(true)}
        >
          👥
          {incomingRequests.length > 0 && (
            <span className="server-icon-badge">{incomingRequests.length}</span>
          )}
        </button>
        <div className="server-rail-divider" />
        {guilds.map((g) => (
          <button
            key={g.id}
            className={
              "server-icon" + (g.id === currentGuildId ? " server-icon--active" : "")
            }
            title={g.name}
            onClick={() => switchGuild(g.id)}
          >
            {g.name.slice(0, 1).toUpperCase()}
          </button>
        ))}
        <button
          className="server-icon server-icon--add"
          title="Criar ou entrar em um servidor"
          onClick={() => setShowServerModal(true)}
        >
          +
        </button>
      </aside>

      <aside className="channel-list">
        <div className="channel-list-header">
          <span>{currentGuild?.name || "Concord"}</span>
          <div className="channel-list-header-actions">
            {canModerate && (
              <button className="invite-btn" onClick={toggleWebhooks} title="Webhooks">
                🪝
              </button>
            )}
            <button className="invite-btn" onClick={toggleInvite} title="Convidar gente">
              👤+
            </button>
          </div>
        </div>
        {inviteCode && (
          <div className="invite-code-box invite-code-box--inline">
            <code>{inviteCode}</code>
            <button type="button" onClick={() => navigator.clipboard?.writeText(inviteCode)}>
              Copiar
            </button>
          </div>
        )}
        {showWebhooks && (
          <div className="webhook-panel">
            {webhooks.length === 0 && <p className="webhook-empty">Nenhum webhook ainda.</p>}
            {webhooks.map((w) => (
              <div className="webhook-row" key={w.id}>
                <div className="webhook-row-head">
                  <span>{w.name}</span>
                  <button onClick={() => removeWebhook(w.id)} title="Apagar">
                    ✕
                  </button>
                </div>
                <div className="invite-code-box">
                  <code className="webhook-url">{webhookUrl(w)}</code>
                  <button type="button" onClick={() => navigator.clipboard?.writeText(webhookUrl(w))}>
                    Copiar
                  </button>
                </div>
              </div>
            ))}
            <button className="webhook-create-btn" onClick={createWebhook}>
              + Criar webhook
            </button>
          </div>
        )}
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
              {canModerate && !u.isAdmin && u.userId !== identity.userId && (
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
        {currentGuildId && (
          <VoicePanel key={currentGuildId} socket={socket} myNickname={identity.nickname} />
        )}
        <Chat
          messages={messages}
          onSend={(text) => socket.emit("chat:message", text)}
          onDelete={(id) => socket.emit("chat:delete", id)}
          myUserId={identity.userId}
          isAdmin={canModerate}
        />
      </main>

      {showServerModal && (
        <ServerModal
          onClose={() => setShowServerModal(false)}
          onCreate={async (name) => {
            const res = await emitAsync("guild:create", { name });
            if (res.ok) {
              setGuilds((prev) => [...prev, res.guild]);
              await switchGuild(res.guild.id);
            }
            return res;
          }}
          onJoin={async (code) => {
            const res = await emitAsync("guild:join", { inviteCode: code });
            if (res.ok) {
              setGuilds((prev) =>
                prev.some((g) => g.id === res.guild.id) ? prev : [...prev, res.guild]
              );
              await switchGuild(res.guild.id);
            }
            return res;
          }}
        />
      )}

      {showFriendsModal && (
        <FriendsModal
          friends={friends}
          incomingRequests={incomingRequests}
          outgoingRequests={outgoingRequests}
          currentGuildId={currentGuildId}
          onClose={() => setShowFriendsModal(false)}
          onSendRequest={async (nickname) => {
            const res = await emitAsync("friend:request", { nickname });
            if (res.ok) {
              if (res.status === "accepted") {
                setFriends((prev) => [...prev, { ...res.friend, online: true }]);
              } else {
                setOutgoingRequests((prev) => [...prev, { id: null, nickname }]);
              }
            }
            return res;
          }}
          onAccept={async (r) => {
            const res = await emitAsync("friend:accept", { userId: r.id });
            if (res.ok) {
              setIncomingRequests((prev) => prev.filter((i) => i.id !== r.id));
              setFriends((prev) => [...prev, res.friend]);
            }
            return res;
          }}
          onDecline={async (r) => {
            await emitAsync("friend:decline", { userId: r.id });
            setIncomingRequests((prev) => prev.filter((i) => i.id !== r.id));
          }}
          onRemove={async (f) => {
            if (!window.confirm(`Desfazer amizade com ${f.nickname}?`)) return;
            await emitAsync("friend:remove", { userId: f.id });
            setFriends((prev) => prev.filter((x) => x.id !== f.id));
          }}
          onInviteToGuild={async (f) => {
            const res = await emitAsync("friend:invite-to-guild", {
              friendId: f.id,
              guildId: currentGuildId,
            });
            return res;
          }}
        />
      )}
    </div>
  );
}
