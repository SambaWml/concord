import pg from "pg";

const { Pool } = pg;

// Neon/Render/qualquer Postgres gerenciado gratuito exige SSL, mas geralmente
// com certificado que o node não reconhece por padrão — por isso relaxamos a
// verificação aqui. Para um Postgres local sem SSL isso não atrapalha.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      nickname TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id),
      nickname TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at);
  `);

  // adicionada depois que o servidor já tinha usuários sem senha — contas
  // criadas antes disso ficam com password_hash NULL até alguém "reivindicar"
  // o apelido com uma senha (ver findUserByNickname/createUser em socket.js).
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bans (
      user_id UUID PRIMARY KEY REFERENCES users(id),
      banned_by TEXT NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY,
      actor_nickname TEXT NOT NULL,
      action TEXT NOT NULL,
      target_nickname TEXT,
      detail TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function findUserByNickname(nickname) {
  const { rows } = await pool.query(
    `SELECT id, nickname, password_hash FROM users WHERE LOWER(nickname) = LOWER($1)`,
    [nickname]
  );
  return rows[0];
}

export async function findUserById(id) {
  const { rows } = await pool.query(
    `SELECT id, nickname, password_hash FROM users WHERE id = $1`,
    [id]
  );
  return rows[0];
}

export async function createUser(id, nickname, passwordHash) {
  await pool.query(
    `INSERT INTO users (id, nickname, password_hash) VALUES ($1, $2, $3)`,
    [id, nickname, passwordHash]
  );
}

export async function setPasswordHash(id, passwordHash) {
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, id]);
}

export async function touchLastSeen(id) {
  await pool.query(`UPDATE users SET last_seen = now() WHERE id = $1`, [id]);
}

export async function insertMessage(userId, nickname, content) {
  const { rows } = await pool.query(
    `INSERT INTO messages (user_id, nickname, content)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, nickname, content, created_at`,
    [userId, nickname, content]
  );
  return rows[0];
}

export async function getRecentMessages(limit = 50) {
  const { rows } = await pool.query(
    `SELECT id, user_id, nickname, content, created_at
     FROM messages
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.reverse();
}

export async function getMessageById(id) {
  const { rows } = await pool.query(
    `SELECT id, user_id, nickname, content FROM messages WHERE id = $1`,
    [id]
  );
  return rows[0];
}

export async function deleteMessage(id) {
  await pool.query(`DELETE FROM messages WHERE id = $1`, [id]);
}

export async function isBanned(userId) {
  const { rows } = await pool.query(`SELECT 1 FROM bans WHERE user_id = $1`, [userId]);
  return rows.length > 0;
}

export async function banUser(userId, bannedBy, reason = null) {
  await pool.query(
    `INSERT INTO bans (user_id, banned_by, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET banned_by = $2, reason = $3, created_at = now()`,
    [userId, bannedBy, reason]
  );
}

export async function unbanUser(userId) {
  await pool.query(`DELETE FROM bans WHERE user_id = $1`, [userId]);
}

export async function addAuditLog(actorNickname, action, targetNickname, detail = null) {
  await pool.query(
    `INSERT INTO audit_log (actor_nickname, action, target_nickname, detail)
     VALUES ($1, $2, $3, $4)`,
    [actorNickname, action, targetNickname, detail]
  );
}
