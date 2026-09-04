import { useState } from "react";

export default function ServerModal({ onClose, onCreate, onJoin }) {
  const [tab, setTab] = useState("create"); // create | join
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdInvite, setCreatedInvite] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (tab === "create") {
        const res = await onCreate(name.trim());
        if (!res.ok) {
          setError(res.error || "Não foi possível criar o servidor.");
          return;
        }
        setCreatedInvite(res.inviteCode);
      } else {
        const res = await onJoin(inviteCode.trim());
        if (!res.ok) {
          setError(res.error || "Não foi possível entrar.");
          return;
        }
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  if (createdInvite) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <h2>Servidor criado 🎉</h2>
          <p>Convite pra chamar gente:</p>
          <div className="invite-code-box">
            <code>{createdInvite}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(createdInvite)}
            >
              Copiar
            </button>
          </div>
          <button className="modal-primary" onClick={onClose}>
            Entrar no servidor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-tabs">
          <button
            className={tab === "create" ? "modal-tab modal-tab--active" : "modal-tab"}
            onClick={() => setTab("create")}
            type="button"
          >
            Criar servidor
          </button>
          <button
            className={tab === "join" ? "modal-tab modal-tab--active" : "modal-tab"}
            onClick={() => setTab("join")}
            type="button"
          >
            Entrar com convite
          </button>
        </div>

        <form onSubmit={submit}>
          {tab === "create" ? (
            <input
              autoFocus
              maxLength={50}
              placeholder="Nome do servidor"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          ) : (
            <input
              autoFocus
              maxLength={16}
              placeholder="Código do convite"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            />
          )}
          {error && <div className="login-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="modal-secondary">
              Cancelar
            </button>
            <button
              type="submit"
              className="modal-primary"
              disabled={busy || (tab === "create" ? !name.trim() : !inviteCode.trim())}
            >
              {tab === "create" ? "Criar" : "Entrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
