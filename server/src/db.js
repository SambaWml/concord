// Sem DATABASE_URL definida, usa SQLite local (zero config, zero conta,
// zero custo) — ótimo pra rodar/testar agora mesmo. Defina DATABASE_URL
// (ex: Postgres grátis do Neon.tech) pra usar em produção, onde o disco
// local não sobrevive a cada deploy.
const impl = process.env.DATABASE_URL
  ? await import("./db.postgres.js")
  : await import("./db.sqlite.js");

export const initDb = impl.initDb;
export const upsertUser = impl.upsertUser;
export const insertMessage = impl.insertMessage;
export const getRecentMessages = impl.getRecentMessages;
export const getMessageById = impl.getMessageById;
export const deleteMessage = impl.deleteMessage;
export const isBanned = impl.isBanned;
export const banUser = impl.banUser;
export const unbanUser = impl.unbanUser;
export const addAuditLog = impl.addAuditLog;
