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
}

export async function upsertUser(id, nickname) {
  await pool.query(
    `INSERT INTO users (id, nickname)
     VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET nickname = $2, last_seen = now()`,
    [id, nickname]
  );
}

export async function insertMessage(userId, nickname, content) {
  const { rows } = await pool.query(
    `INSERT INTO messages (user_id, nickname, content)
     VALUES ($1, $2, $3)
     RETURNING id, nickname, content, created_at`,
    [userId, nickname, content]
  );
  return rows[0];
}

export async function getRecentMessages(limit = 50) {
  const { rows } = await pool.query(
    `SELECT id, nickname, content, created_at
     FROM messages
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.reverse();
}
