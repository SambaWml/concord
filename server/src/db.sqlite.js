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

// Todo mundo que já usava o Concord antes de existirem múltiplos servidores
// continua caindo automaticamente aqui — ver ensureDefaultGuild() abaixo.
export const DEFAULT_GUILD_ID = "00000000-0000-0000-0000-000000000001";

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
    CREATE TABLE IF NOT EXISTS guilds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_members (
      guild_id TEXT REFERENCES guilds(id),
      user_id TEXT REFERENCES users(id),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (guild_id, user_id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS invites (
      code TEXT PRIMARY KEY,
      guild_id TEXT REFERENCES guilds(id),
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT REFERENCES guilds(id),
      user_id TEXT REFERENCES users(id),
      nickname TEXT NOT NULL,
      content TEXT NOT NULL,
      via_webhook INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  try {
    db.exec(`ALTER TABLE messages ADD COLUMN guild_id TEXT REFERENCES guilds(id)`);
  } catch {
    // já existe
  }
  try {
    db.exec(`ALTER TABLE messages ADD COLUMN via_webhook INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // já existe
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS bans (
      user_id TEXT REFERENCES users(id),
      guild_id TEXT REFERENCES guilds(id),
      banned_by TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (guild_id, user_id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT REFERENCES guilds(id),
      actor_nickname TEXT NOT NULL,
      action TEXT NOT NULL,
      target_nickname TEXT,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      guild_id TEXT REFERENCES guilds(id),
      name TEXT NOT NULL,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS friendships (
      requester_id TEXT REFERENCES users(id),
      addressee_id TEXT REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (requester_id, addressee_id)
    );
  `);

  ensureDefaultGuild();

  console.log(`[dev] usando SQLite local em ${dbPath}`);
  console.log("[dev] defina DATABASE_URL no .env pra usar Postgres em vez disso");
}

// Garante que sempre existe um servidor "Geral" — é onde todo mundo que já
// usava o Concord antes de servidores múltiplos continua caindo, e é o
// servidor padrão de qualquer instalação nova.
function ensureDefaultGuild() {
  db.prepare(`INSERT OR IGNORE INTO guilds (id, name, owner_id) VALUES (?, 'Geral', NULL)`).run(
    DEFAULT_GUILD_ID
  );
  db.prepare(`UPDATE messages SET guild_id = ? WHERE guild_id IS NULL`).run(DEFAULT_GUILD_ID);
  db.prepare(
    `INSERT OR IGNORE INTO guild_members (guild_id, user_id) SELECT ?, id FROM users`
  ).run(DEFAULT_GUILD_ID);
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

// --- servidores (guilds) ---

export async function createGuild(id, name, ownerId) {
  db.prepare(`INSERT INTO guilds (id, name, owner_id) VALUES (?, ?, ?)`).run(id, name, ownerId);
}

export async function getGuildById(id) {
  return db.prepare(`SELECT id, name, owner_id FROM guilds WHERE id = ?`).get(id);
}

export async function getGuildsForUser(userId) {
  return db
    .prepare(
      `SELECT g.id, g.name, g.owner_id
       FROM guilds g
       JOIN guild_members gm ON gm.guild_id = g.id
       WHERE gm.user_id = ?
       ORDER BY gm.joined_at ASC`
    )
    .all(userId);
}

export async function isGuildMember(guildId, userId) {
  const row = db
    .prepare(`SELECT 1 FROM guild_members WHERE guild_id = ? AND user_id = ?`)
    .get(guildId, userId);
  return !!row;
}

export async function addGuildMember(guildId, userId) {
  db.prepare(`INSERT OR IGNORE INTO guild_members (guild_id, user_id) VALUES (?, ?)`).run(
    guildId,
    userId
  );
}

export async function removeGuildMember(guildId, userId) {
  db.prepare(`DELETE FROM guild_members WHERE guild_id = ? AND user_id = ?`).run(guildId, userId);
}

// --- convites ---

export async function createInvite(code, guildId, createdBy) {
  db.prepare(`INSERT INTO invites (code, guild_id, created_by) VALUES (?, ?, ?)`).run(
    code,
    guildId,
    createdBy
  );
}

export async function getInvite(code) {
  return db.prepare(`SELECT code, guild_id, created_by FROM invites WHERE code = ?`).get(code);
}

export async function getInviteForGuild(guildId) {
  return db
    .prepare(`SELECT code FROM invites WHERE guild_id = ? ORDER BY created_at ASC LIMIT 1`)
    .get(guildId);
}

// --- mensagens (agora por servidor) ---

export async function insertMessage(guildId, userId, nickname, content, viaWebhook = false) {
  const info = db
    .prepare(
      `INSERT INTO messages (guild_id, user_id, nickname, content, via_webhook) VALUES (?, ?, ?, ?, ?)`
    )
    .run(guildId, userId, nickname, content, viaWebhook ? 1 : 0);
  const row = db
    .prepare(
      `SELECT id, guild_id, user_id, nickname, content, via_webhook, created_at FROM messages WHERE id = ?`
    )
    .get(info.lastInsertRowid);
  return normalizeRow(row);
}

export async function getRecentMessages(guildId, limit = 50) {
  const rows = db
    .prepare(
      `SELECT id, guild_id, user_id, nickname, content, via_webhook, created_at FROM messages
       WHERE guild_id = ?
       ORDER BY id DESC LIMIT ?`
    )
    .all(guildId, limit);
  return rows.reverse().map(normalizeRow);
}

export async function getMessageById(id) {
  return db
    .prepare(`SELECT id, guild_id, user_id, nickname, content FROM messages WHERE id = ?`)
    .get(id);
}

export async function deleteMessage(id) {
  db.prepare(`DELETE FROM messages WHERE id = ?`).run(id);
}

// --- moderação (agora por servidor) ---

export async function isBanned(guildId, userId) {
  const row = db.prepare(`SELECT 1 FROM bans WHERE guild_id = ? AND user_id = ?`).get(guildId, userId);
  return !!row;
}

export async function banUser(guildId, userId, bannedBy, reason = null) {
  db.prepare(
    `INSERT INTO bans (guild_id, user_id, banned_by, reason) VALUES (?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET banned_by = excluded.banned_by, reason = excluded.reason, created_at = datetime('now')`
  ).run(guildId, userId, bannedBy, reason);
}

export async function unbanUser(guildId, userId) {
  db.prepare(`DELETE FROM bans WHERE guild_id = ? AND user_id = ?`).run(guildId, userId);
}

export async function addAuditLog(guildId, actorNickname, action, targetNickname, detail = null) {
  db.prepare(
    `INSERT INTO audit_log (guild_id, actor_nickname, action, target_nickname, detail) VALUES (?, ?, ?, ?, ?)`
  ).run(guildId, actorNickname, action, targetNickname, detail);
}

// --- amizades ---

export async function getFriendshipEither(userA, userB) {
  return db
    .prepare(
      `SELECT requester_id, addressee_id, status FROM friendships
       WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`
    )
    .get(userA, userB, userB, userA);
}

export async function createFriendRequest(requesterId, addresseeId) {
  db.prepare(
    `INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')`
  ).run(requesterId, addresseeId);
}

export async function acceptFriendRequest(requesterId, addresseeId) {
  db.prepare(
    `UPDATE friendships SET status = 'accepted' WHERE requester_id = ? AND addressee_id = ?`
  ).run(requesterId, addresseeId);
}

export async function deleteFriendshipEither(userA, userB) {
  db.prepare(
    `DELETE FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`
  ).run(userA, userB, userB, userA);
}

export async function getFriends(userId) {
  return db
    .prepare(
      `SELECT u.id, u.nickname
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
       WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
       ORDER BY u.nickname`
    )
    .all(userId, userId, userId);
}

export async function getIncomingRequests(userId) {
  return db
    .prepare(
      `SELECT u.id, u.nickname FROM friendships f
       JOIN users u ON u.id = f.requester_id
       WHERE f.addressee_id = ? AND f.status = 'pending'
       ORDER BY f.created_at`
    )
    .all(userId);
}

export async function getOutgoingRequests(userId) {
  return db
    .prepare(
      `SELECT u.id, u.nickname FROM friendships f
       JOIN users u ON u.id = f.addressee_id
       WHERE f.requester_id = ? AND f.status = 'pending'
       ORDER BY f.created_at`
    )
    .all(userId);
}

// --- webhooks ---

export async function createWebhook(id, token, guildId, name, createdBy) {
  db.prepare(
    `INSERT INTO webhooks (id, token, guild_id, name, created_by) VALUES (?, ?, ?, ?, ?)`
  ).run(id, token, guildId, name, createdBy);
}

export async function getWebhook(id, token) {
  return db
    .prepare(`SELECT id, token, guild_id, name FROM webhooks WHERE id = ? AND token = ?`)
    .get(id, token);
}

export async function getWebhooksForGuild(guildId) {
  return db
    .prepare(`SELECT id, token, name, created_at FROM webhooks WHERE guild_id = ? ORDER BY created_at`)
    .all(guildId);
}

export async function deleteWebhook(id, guildId) {
  db.prepare(`DELETE FROM webhooks WHERE id = ? AND guild_id = ?`).run(id, guildId);
}

function normalizeRow(row) {
  if (!row) return row;
  const normalized = { ...row };
  // SQLite grava "2026-09-04 15:53:23" (UTC, sem fuso) — o front lê essa
  // string com `new Date(...)`, que só interpreta UTC corretamente com um
  // formato ISO explícito.
  if (normalized.created_at) {
    normalized.created_at = normalized.created_at.replace(" ", "T") + "Z";
  }
  // SQLite guarda booleano como 0/1 — normaliza pra bater com o Postgres
  if ("via_webhook" in normalized) normalized.via_webhook = !!normalized.via_webhook;
  return normalized;
}
