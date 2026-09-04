import { useState } from "react";

export default function Login({ onEnter, error, defaultNickname = "" }) {
  const [nickname, setNickname] = useState(defaultNickname);
  const [password, setPassword] = useState("");

  function submit(e) {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed || !password) return;
    onEnter(trimmed, password);
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">C</div>
        <h1>Entrar no Concord</h1>
        <p>
          Apelido + senha. Primeira vez com esse apelido? A senha que você
          digitar vira a senha da conta.
        </p>
        <input
          autoFocus={!defaultNickname}
          maxLength={24}
          placeholder="Seu apelido"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <input
          autoFocus={!!defaultNickname}
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={!nickname.trim() || !password}>
          Entrar
        </button>
      </form>
    </div>
  );
}
