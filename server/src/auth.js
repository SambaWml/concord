import crypto from "node:crypto";

// Hash de senha com o módulo crypto nativo do Node (scrypt) — sem
// dependência externa, no mesmo espírito de usar node:sqlite em vez de um
// pacote de banco. Formato salvo: "salt:hash", ambos em hex.

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const check = crypto.scryptSync(password, salt, 64).toString("hex");
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(check, "hex");
    // tamanho diferente já denuncia hash inválido; timingSafeEqual exige
    // buffers do mesmo tamanho ou lança erro
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
