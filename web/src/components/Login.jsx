import { useState } from "react";

export default function Login({ onEnter, error }) {
  const [nickname, setNickname] = useState("");

  function submit(e) {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) return;
    onEnter(trimmed);
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">C</div>
        <h1>Entrar no Concord</h1>
        <p>Escolha um apelido para entrar no servidor Geral.</p>
        <input
          autoFocus
          maxLength={24}
          placeholder="Seu apelido"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={!nickname.trim()}>
          Entrar
        </button>
      </form>
    </div>
  );
}
