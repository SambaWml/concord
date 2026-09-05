import pg from "pg";
import { randomUUID } from "node:crypto";

const { Pool } = pg;

// Todo mundo que já usava o Concord antes de existirem múltiplos servidores
// continua caindo automaticamente aqui — ver ensureDefaultGuild() abaixo.
export const DEFAULT_GUILD_ID = "00000000-0000-0000-0000-000000000001";

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

  // adicionada depois que o servidor já tinha usuários sem senha — contas
  // criadas antes disso ficam com password_hash NULL até alguém "reivindicar"
  // o apelido com uma senha (ver findUserByNickname/createUser em socket.js).
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS guilds (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS guild_members (
      guild_id UUID REFERENCES guilds(id),
      user_id UUID REFERENCES users(id),
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (guild_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invites (
      code TEXT PRIMARY KEY,
      guild_id UUID REFERENCES guilds(id),
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS channels (
      id UUID PRIMARY KEY,
      guild_id UUID REFERENCES guilds(id),
      category TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      guild_id UUID REFERENCES guilds(id),
      channel_id UUID REFERENCES channels(id),
      user_id UUID REFERENCES users(id),
      nickname TEXT NOT NULL,
      content TEXT NOT NULL,
      via_webhook BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS guild_id UUID REFERENCES guilds(id);`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES channels(id);`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS via_webhook BOOLEAN NOT NULL DEFAULT false;`);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS messages_channel_created_idx ON messages (channel_id, created_at);
  `);

  // tabela nova (instalação do zero) já nasce com a chave composta certa
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bans (
      user_id UUID REFERENCES users(id),
      guild_id UUID REFERENCES guilds(id),
      banned_by TEXT NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (guild_id, user_id)
    );
  `);
  // tabela que já existia (banimento era global, PK só em user_id) precisa
  // migrar pra chave composta — roda só uma vez; nas próximas, a tentativa
  // de dropar uma constraint que não existe mais falha e é ignorada.
  await pool.query(`ALTER TABLE bans ADD COLUMN IF NOT EXISTS guild_id UUID REFERENCES guilds(id);`);
  try {
    await pool.query(`ALTER TABLE bans DROP CONSTRAINT bans_pkey;`);
    await pool.query(`ALTER TABLE bans ADD PRIMARY KEY (guild_id, user_id);`);
  } catch {
    // já migrado numa inicialização anterior (ou já nasceu certo, acima)
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY,
      guild_id UUID REFERENCES guilds(id),
      actor_nickname TEXT NOT NULL,
      action TEXT NOT NULL,
      target_nickname TEXT,
      detail TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS guild_id UUID REFERENCES guilds(id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id UUID PRIMARY KEY,
      token TEXT NOT NULL,
      guild_id UUID REFERENCES guilds(id),
      channel_id UUID REFERENCES channels(id),
      name TEXT NOT NULL,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES channels(id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS friendships (
      requester_id UUID REFERENCES users(id),
      addressee_id UUID REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (requester_id, addressee_id)
    );
  `);

  await ensureDefaultGuild();
  await ensureDefaultChannels();
}

// Garante que sempre existe um servidor "Geral" — é onde todo mundo que já
// usava o Concord antes de servidores múltiplos continua caindo, e é o
// servidor padrão de qualquer instalação nova.
async function ensureDefaultGuild() {
  await pool.query(
    `INSERT INTO guilds (id, name, owner_id) VALUES ($1, 'Geral', NULL)
     ON CONFLICT (id) DO NOTHING`,
    [DEFAULT_GUILD_ID]
  );
  // todo mundo que já tem uma conta vira membro do Geral, se ainda não for
  await pool.query(
    `INSERT INTO guild_members (guild_id, user_id)
     SELECT $1, id FROM users
     ON CONFLICT (guild_id, user_id) DO NOTHING`,
    [DEFAULT_GUILD_ID]
  );
}

// Todo servidor precisa nascer com pelo menos um canal de texto e um de
// voz — isso cobre servidores criados antes de canais múltiplos existirem
// (inclusive migra as mensagens deles, que ficaram sem channel_id).
async function ensureDefaultChannels() {
  const { rows } = await pool.query(`
    SELECT g.id FROM guilds g
    WHERE NOT EXISTS (SELECT 1 FROM channels c WHERE c.guild_id = g.id)
  `);
  for (const g of rows) {
    const textId = randomUUID();
    const voiceId = randomUUID();
    await pool.query(
      `INSERT INTO channels (id, guild_id, name, type, position) VALUES
       ($1, $2, 'geral', 'text', 0), ($3, $2, 'Geral', 'voice', 0)`,
      [textId, g.id, voiceId]
    );
    await pool.query(
      `UPDATE messages SET channel_id = $1 WHERE guild_id = $2 AND channel_id IS NULL`,
      [textId, g.id]
    );
  }
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

// --- servidores (guilds) ---

export async function createGuild(id, name, ownerId) {
  await pool.query(`INSERT INTO guilds (id, name, owner_id) VALUES ($1, $2, $3)`, [
    id,
    name,
    ownerId,
  ]);
}

export async function getGuildById(id) {
  const { rows } = await pool.query(`SELECT id, name, owner_id FROM guilds WHERE id = $1`, [id]);
  return rows[0];
}

export async function getGuildsForUser(userId) {
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.owner_id
     FROM guilds g
     JOIN guild_members gm ON gm.guild_id = g.id
     WHERE gm.user_id = $1
     ORDER BY gm.joined_at ASC`,
    [userId]
  );
  return rows;
}

export async function isGuildMember(guildId, userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2`,
    [guildId, userId]
  );
  return rows.length > 0;
}

export async function addGuildMember(guildId, userId) {
  await pool.query(
    `INSERT INTO guild_members (guild_id, user_id) VALUES ($1, $2)
     ON CONFLICT (guild_id, user_id) DO NOTHING`,
    [guildId, userId]
  );
}

export async function removeGuildMember(guildId, userId) {
  await pool.query(`DELETE FROM guild_members WHERE guild_id = $1 AND user_id = $2`, [
    guildId,
    userId,
  ]);
}

// --- convites ---

export async function createInvite(code, guildId, createdBy) {
  await pool.query(`INSERT INTO invites (code, guild_id, created_by) VALUES ($1, $2, $3)`, [
    code,
    guildId,
    createdBy,
  ]);
}

export async function getInvite(code) {
  const { rows } = await pool.query(`SELECT code, guild_id, created_by FROM invites WHERE code = $1`, [
    code,
  ]);
  return rows[0];
}

export async function getInviteForGuild(guildId) {
  const { rows } = await pool.query(
    `SELECT code FROM invites WHERE guild_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [guildId]
  );
  return rows[0];
}

// --- canais ---

export async function createChannel(id, guildId, name, type, category = null, position = 0) {
  await pool.query(
    `INSERT INTO channels (id, guild_id, name, type, category, position) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, guildId, name, type, category, position]
  );
}

export async function getChannelsForGuild(guildId) {
  const { rows } = await pool.query(
    `SELECT id, guild_id, category, name, type, position FROM channels
     WHERE guild_id = $1 ORDER BY category NULLS FIRST, position, name`,
    [guildId]
  );
  return rows;
}

export async function getChannelById(id) {
  const { rows } = await pool.query(
    `SELECT id, guild_id, category, name, type, position FROM channels WHERE id = $1`,
    [id]
  );
  return rows[0];
}

export async function deleteChannel(id, guildId) {
  await pool.query(`DELETE FROM channels WHERE id = $1 AND guild_id = $2`, [id, guildId]);
}

// --- mensagens (agora por canal) ---

export async function insertMessage(guildId, channelId, userId, nickname, content, viaWebhook = false) {
  const { rows } = await pool.query(
    `INSERT INTO messages (guild_id, channel_id, user_id, nickname, content, via_webhook)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, guild_id, channel_id, user_id, nickname, content, via_webhook, created_at`,
    [guildId, channelId, userId, nickname, content, viaWebhook]
  );
  return rows[0];
}

export async function getRecentMessages(channelId, limit = 50) {
  const { rows } = await pool.query(
    `SELECT id, guild_id, channel_id, user_id, nickname, content, via_webhook, created_at
     FROM messages
     WHERE channel_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [channelId, limit]
  );
  return rows.reverse();
}

export async function getMessageById(id) {
  const { rows } = await pool.query(
    `SELECT id, guild_id, channel_id, user_id, nickname, content FROM messages WHERE id = $1`,
    [id]
  );
  return rows[0];
}

export async function deleteMessage(id) {
  await pool.query(`DELETE FROM messages WHERE id = $1`, [id]);
}

// --- moderação (agora por servidor) ---

export async function isBanned(guildId, userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM bans WHERE guild_id = $1 AND user_id = $2`,
    [guildId, userId]
  );
  return rows.length > 0;
}

export async function banUser(guildId, userId, bannedBy, reason = null) {
  await pool.query(
    `INSERT INTO bans (guild_id, user_id, banned_by, reason)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (guild_id, user_id) DO UPDATE SET banned_by = $3, reason = $4, created_at = now()`,
    [guildId, userId, bannedBy, reason]
  );
}

export async function unbanUser(guildId, userId) {
  await pool.query(`DELETE FROM bans WHERE guild_id = $1 AND user_id = $2`, [guildId, userId]);
}

export async function addAuditLog(guildId, actorNickname, action, targetNickname, detail = null) {
  await pool.query(
    `INSERT INTO audit_log (guild_id, actor_nickname, action, target_nickname, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [guildId, actorNickname, action, targetNickname, detail]
  );
}

// --- amizades ---

export async function getFriendshipEither(userA, userB) {
  const { rows } = await pool.query(
    `SELECT requester_id, addressee_id, status FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [userA, userB]
  );
  return rows[0];
}

export async function createFriendRequest(requesterId, addresseeId) {
  await pool.query(
    `INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'pending')`,
    [requesterId, addresseeId]
  );
}

export async function acceptFriendRequest(requesterId, addresseeId) {
  await pool.query(
    `UPDATE friendships SET status = 'accepted' WHERE requester_id = $1 AND addressee_id = $2`,
    [requesterId, addresseeId]
  );
}

export async function deleteFriendshipEither(userA, userB) {
  await pool.query(
    `DELETE FROM friendships WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [userA, userB]
  );
}

export async function getFriends(userId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.nickname
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
     ORDER BY u.nickname`,
    [userId]
  );
  return rows;
}

export async function getIncomingRequests(userId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.nickname FROM friendships f
     JOIN users u ON u.id = f.requester_id
     WHERE f.addressee_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at`,
    [userId]
  );
  return rows;
}

export async function getOutgoingRequests(userId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.nickname FROM friendships f
     JOIN users u ON u.id = f.addressee_id
     WHERE f.requester_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at`,
    [userId]
  );
  return rows;
}

// --- webhooks ---

export async function createWebhook(id, token, guildId, channelId, name, createdBy) {
  await pool.query(
    `INSERT INTO webhooks (id, token, guild_id, channel_id, name, created_by) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, token, guildId, channelId, name, createdBy]
  );
}

export async function getWebhook(id, token) {
  const { rows } = await pool.query(
    `SELECT id, token, guild_id, channel_id, name FROM webhooks WHERE id = $1 AND token = $2`,
    [id, token]
  );
  return rows[0];
}

export async function getWebhooksForGuild(guildId) {
  const { rows } = await pool.query(
    `SELECT id, token, name, created_at FROM webhooks WHERE guild_id = $1 ORDER BY created_at`,
    [guildId]
  );
  return rows;
}

export async function deleteWebhook(id, guildId) {
  await pool.query(`DELETE FROM webhooks WHERE id = $1 AND guild_id = $2`, [id, guildId]);
}
