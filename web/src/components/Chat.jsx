import { useEffect, useRef, useState } from "react";

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
        {messages.map((m) => {
          if (m.system) {
            return (
              <div className="chat-system" key={m.id}>
                {m.content}
              </div>
            );
          }
          const isMine = m.user_id === myUserId;
          const canDelete = isMine || isAdmin;
          return (
            <div
              className={"chat-message" + (isMine ? " chat-message--mine" : "")}
              key={m.id}
            >
              <div className="chat-message-head">
                <span className="chat-message-author">{m.nickname}</span>
                <span className="chat-message-time">{formatTime(m.created_at)}</span>
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
              <div className="chat-message-body">{m.content}</div>
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
