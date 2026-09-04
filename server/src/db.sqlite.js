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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES users(id),
      nickname TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log(`[dev] usando SQLite local em ${dbPath}`);
  console.log("[dev] defina DATABASE_URL no .env pra usar Postgres em vez disso");
}

export async function upsertUser(id, nickname) {
  db.prepare(
    `INSERT INTO users (id, nickname) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET nickname = excluded.nickname, last_seen = datetime('now')`
  ).run(id, nickname);
}

export async function insertMessage(userId, nickname, content) {
  const info = db
    .prepare(`INSERT INTO messages (user_id, nickname, content) VALUES (?, ?, ?)`)
    .run(userId, nickname, content);
  const row = db
    .prepare(`SELECT id, nickname, content, created_at FROM messages WHERE id = ?`)
    .get(info.lastInsertRowid);
  return normalizeRow(row);
}

export async function getRecentMessages(limit = 50) {
  const rows = db
    .prepare(
      `SELECT id, nickname, content, created_at FROM messages
       ORDER BY id DESC LIMIT ?`
    )
    .all(limit);
  return rows.reverse().map(normalizeRow);
}

function normalizeRow(row) {
  if (!row) return row;
  // SQLite grava "2026-09-04 15:53:23" (UTC, sem fuso) — o front lê essa
  // string com `new Date(...)`, que só interpreta UTC corretamente com um
  // formato ISO explícito.
  return { ...row, created_at: row.created_at.replace(" ", "T") + "Z" };
}
