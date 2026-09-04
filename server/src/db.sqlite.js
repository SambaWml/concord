import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Banco local pra rodar o Concord sem precisar de nenhuma conta/serviço
// externo — 100% de graça e offline. Usado automaticamente quando não há
// DATABASE_URL definida (veja db.js). Em produção, defina DATABASE_URL
// (ex: Neon.tech) pra usar o Postgres de db.postgres.js.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "../data");
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "concord.db");

const db = new DatabaseSync(dbPath);

export async function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      password_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // pra quem já tinha um concord.db local de antes desse recurso existir
  try {
    db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
  } catch {
    // coluna já existe (banco criado com a versão de cima, ou migração já rodou)
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES users(id),
      nickname TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS bans (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      banned_by TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_nickname TEXT NOT NULL,
      action TEXT NOT NULL,
      target_nickname TEXT,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log(`[dev] usando SQLite local em ${dbPath}`);
  console.log("[dev] defina DATABASE_URL no .env pra usar Postgres em vez disso");
}

export async function findUserByNickname(nickname) {
  return db
    .prepare(`SELECT id, nickname, password_hash FROM users WHERE LOWER(nickname) = LOWER(?)`)
    .get(nickname);
}

export async function findUserById(id) {
  return db.prepare(`SELECT id, nickname, password_hash FROM users WHERE id = ?`).get(id);
}

export async function createUser(id, nickname, passwordHash) {
  db.prepare(`INSERT INTO users (id, nickname, password_hash) VALUES (?, ?, ?)`).run(
    id,
    nickname,
    passwordHash
  );
}

export async function setPasswordHash(id, passwordHash) {
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(passwordHash, id);
}

export async function touchLastSeen(id) {
  db.prepare(`UPDATE users SET last_seen = datetime('now') WHERE id = ?`).run(id);
}

export async function insertMessage(userId, nickname, content) {
  const info = db
    .prepare(`INSERT INTO messages (user_id, nickname, content) VALUES (?, ?, ?)`)
    .run(userId, nickname, content);
  const row = db
    .prepare(`SELECT id, user_id, nickname, content, created_at FROM messages WHERE id = ?`)
    .get(info.lastInsertRowid);
  return normalizeRow(row);
}

export async function getRecentMessages(limit = 50) {
  const rows = db
    .prepare(
      `SELECT id, user_id, nickname, content, created_at FROM messages
       ORDER BY id DESC LIMIT ?`
    )
    .all(limit);
  return rows.reverse().map(normalizeRow);
}

export async function getMessageById(id) {
  return db
    .prepare(`SELECT id, user_id, nickname, content FROM messages WHERE id = ?`)
    .get(id);
}

export async function deleteMessage(id) {
  db.prepare(`DELETE FROM messages WHERE id = ?`).run(id);
}

export async function isBanned(userId) {
  const row = db.prepare(`SELECT 1 FROM bans WHERE user_id = ?`).get(userId);
  return !!row;
}

export async function banUser(userId, bannedBy, reason = null) {
  db.prepare(
    `INSERT INTO bans (user_id, banned_by, reason) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET banned_by = excluded.banned_by, reason = excluded.reason, created_at = datetime('now')`
  ).run(userId, bannedBy, reason);
}

export async function unbanUser(userId) {
  db.prepare(`DELETE FROM bans WHERE user_id = ?`).run(userId);
}

export async function addAuditLog(actorNickname, action, targetNickname, detail = null) {
  db.prepare(
    `INSERT INTO audit_log (actor_nickname, action, target_nickname, detail) VALUES (?, ?, ?, ?)`
  ).run(actorNickname, action, targetNickname, detail);
}

function normalizeRow(row) {
  if (!row) return row;
  // SQLite grava "2026-09-04 15:53:23" (UTC, sem fuso) — o front lê essa
  // string com `new Date(...)`, que só interpreta UTC corretamente com um
  // formato ISO explícito.
  return { ...row, created_at: row.created_at.replace(" ", "T") + "Z" };
}
