import { useState } from "react";
import { avatarColor, initial } from "../utils/avatar.js";

export default function FriendsModal({
  friends,
  incomingRequests,
  outgoingRequests,
  currentGuildId,
  onClose,
  onSendRequest,
  onAccept,
  onDecline,
  onRemove,
  onInviteToGuild,
}) {
  const [tab, setTab] = useState(incomingRequests.length > 0 ? "requests" : "friends");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submitRequest(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    const trimmed = nickname.trim();
    if (!trimmed) return;
    const res = await onSendRequest(trimmed);
    if (!res.ok) {
      setError(res.error || "Não foi possível enviar o pedido.");
    } else {
      setNotice(res.status === "accepted" ? `Você e ${trimmed} agora são amigos.` : "Pedido enviado.");
      setNickname("");
    }
  }

  async function invite(friend) {
    const res = await onInviteToGuild(friend);
    setNotice(res.ok ? `${friend.nickname} foi adicionado ao servidor.` : res.error);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-tabs">
          <button
            className={tab === "friends" ? "modal-tab modal-tab--active" : "modal-tab"}
            onClick={() => setTab("friends")}
            type="button"
          >
            Amigos ({friends.length})
          </button>
          <button
            className={tab === "requests" ? "modal-tab modal-tab--active" : "modal-tab"}
            onClick={() => setTab("requests")}
            type="button"
          >
            Pedidos {incomingRequests.length > 0 && `(${incomingRequests.length})`}
          </button>
          <button
            className={tab === "add" ? "modal-tab modal-tab--active" : "modal-tab"}
            onClick={() => setTab("add")}
            type="button"
          >
            Adicionar
          </button>
        </div>

        {notice && <div className="friends-notice">{notice}</div>}

        {tab === "friends" && (
          <div className="friends-list">
            {friends.length === 0 && <p className="friends-empty">Ainda sem amigos por aqui.</p>}
            {friends.map((f) => (
              <div className="friend-row" key={f.id}>
                <span className="online-user-avatar" style={{ background: avatarColor(f.nickname) }}>
                  {initial(f.nickname)}
                  <span className={"avatar-status-dot" + (f.online ? "" : " avatar-status-dot--off")} />
                </span>
                <span className="friend-name">{f.nickname}</span>
                <div className="friend-actions">
                  {currentGuildId && (
                    <button onClick={() => invite(f)} title="Convidar pro servidor atual">
                      Convidar
                    </button>
                  )}
                  <button onClick={() => onRemove(f)} title="Desfazer amizade" className="friend-remove">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "requests" && (
          <div className="friends-list">
            {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
              <p className="friends-empty">Nenhum pedido pendente.</p>
            )}
            {incomingRequests.map((r) => (
              <div className="friend-row" key={r.id}>
                <span className="online-user-avatar" style={{ background: avatarColor(r.nickname) }}>
                  {initial(r.nickname)}
                </span>
                <span className="friend-name">{r.nickname}</span>
                <div className="friend-actions">
                  <button onClick={() => onAccept(r)} className="friend-accept">
                    Aceitar
                  </button>
                  <button onClick={() => onDecline(r)} className="friend-remove">
                    Recusar
                  </button>
                </div>
              </div>
            ))}
            {outgoingRequests.map((r) => (
              <div className="friend-row" key={r.id}>
                <span className="online-user-avatar" style={{ background: avatarColor(r.nickname) }}>
                  {initial(r.nickname)}
                </span>
                <span className="friend-name">{r.nickname}</span>
                <span className="friend-pending">pedido enviado</span>
              </div>
            ))}
          </div>
        )}

        {tab === "add" && (
          <form onSubmit={submitRequest}>
            <p>Manda o apelido exato de quem você quer adicionar.</p>
            <input
              autoFocus
              maxLength={24}
              placeholder="Apelido"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            {error && <div className="login-error">{error}</div>}
            <div className="modal-actions">
              <button type="submit" className="modal-primary" disabled={!nickname.trim()}>
                Enviar pedido
              </button>
            </div>
          </form>
        )}

        <button className="modal-secondary modal-close" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}
