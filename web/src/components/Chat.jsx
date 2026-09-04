import { useEffect, useRef, useState } from "react";
import { avatarColor, initial } from "../utils/avatar.js";

const GROUP_WINDOW_MS = 5 * 60 * 1000; // mensagens seguidas da mesma pessoa em até 5min viram um bloco só

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isGrouped(current, previous) {
  if (!previous || current.system || previous.system) return false;
  if (current.nickname !== previous.nickname) return false;
  if (!!current.via_webhook !== !!previous.via_webhook) return false;
  return new Date(current.created_at) - new Date(previous.created_at) < GROUP_WINDOW_MS;
}

export default function Chat({ messages, onSend, onDelete, myUserId, isAdmin }) {
  const [draft, setDraft] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function submit(e) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft("");
  }

  return (
    <div className="chat">
      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            Ainda não tem nenhuma mensagem por aqui. Diga oi 👋
          </div>
        )}
        {messages.map((m, i) => {
          if (m.system) {
            return (
              <div className="chat-system" key={m.id}>
                {m.content}
              </div>
            );
          }
          const grouped = isGrouped(m, messages[i - 1]);
          const isMine = m.user_id === myUserId;
          const canDelete = isMine || isAdmin;
          return (
            <div
              className={
                "chat-message" +
                (isMine ? " chat-message--mine" : "") +
                (grouped ? " chat-message--grouped" : "")
              }
              key={m.id}
            >
              {!grouped && (
                <div className="chat-avatar" style={{ background: avatarColor(m.nickname) }}>
                  {initial(m.nickname)}
                </div>
              )}
              <div className="chat-message-content">
                {!grouped && (
                  <div className="chat-message-head">
                    <span className="chat-message-author">{m.nickname}</span>
                    {m.via_webhook && <span className="chat-webhook-badge">WEBHOOK</span>}
                    <span className="chat-message-time">{formatTime(m.created_at)}</span>
                  </div>
                )}
                <div className="chat-message-body">
                  {m.content}
                  {grouped && (
                    <span className="chat-message-time chat-message-time--grouped">
                      {formatTime(m.created_at)}
                    </span>
                  )}
                </div>
              </div>
              {canDelete && (
                <button
                  className="chat-message-delete"
                  title="Apagar mensagem"
                  onClick={() => onDelete(m.id)}
                >
                  🗑
                </button>
              )}
            </div>
          );
        })}
      </div>
      <form className="chat-composer" onSubmit={submit}>
        <input
          placeholder="Conversar em #geral"
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" disabled={!draft.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
