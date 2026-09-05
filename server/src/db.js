// Sem DATABASE_URL definida, usa SQLite local (zero config, zero conta,
// zero custo) — ótimo pra rodar/testar agora mesmo. Defina DATABASE_URL
// (ex: Postgres grátis do Neon.tech) pra usar em produção, onde o disco
// local não sobrevive a cada deploy.
const impl = process.env.DATABASE_URL
  ? await import("./db.postgres.js")
  : await import("./db.sqlite.js");

export const DEFAULT_GUILD_ID = impl.DEFAULT_GUILD_ID;

export const initDb = impl.initDb;
export const findUserByNickname = impl.findUserByNickname;
export const findUserById = impl.findUserById;
export const createUser = impl.createUser;
export const setPasswordHash = impl.setPasswordHash;
export const touchLastSeen = impl.touchLastSeen;

export const createGuild = impl.createGuild;
export const getGuildById = impl.getGuildById;
export const getGuildsForUser = impl.getGuildsForUser;
export const isGuildMember = impl.isGuildMember;
export const addGuildMember = impl.addGuildMember;
export const removeGuildMember = impl.removeGuildMember;

export const createInvite = impl.createInvite;
export const getInvite = impl.getInvite;
export const getInviteForGuild = impl.getInviteForGuild;

export const createChannel = impl.createChannel;
export const getChannelsForGuild = impl.getChannelsForGuild;
export const getChannelById = impl.getChannelById;
export const deleteChannel = impl.deleteChannel;

export const insertMessage = impl.insertMessage;
export const getRecentMessages = impl.getRecentMessages;
export const getMessageById = impl.getMessageById;
export const deleteMessage = impl.deleteMessage;

export const isBanned = impl.isBanned;
export const banUser = impl.banUser;
export const unbanUser = impl.unbanUser;
export const addAuditLog = impl.addAuditLog;

export const createWebhook = impl.createWebhook;
export const getWebhook = impl.getWebhook;
export const getWebhooksForGuild = impl.getWebhooksForGuild;
export const deleteWebhook = impl.deleteWebhook;

export const getFriendshipEither = impl.getFriendshipEither;
export const createFriendRequest = impl.createFriendRequest;
export const acceptFriendRequest = impl.acceptFriendRequest;
export const deleteFriendshipEither = impl.deleteFriendshipEither;
export const getFriends = impl.getFriends;
export const getIncomingRequests = impl.getIncomingRequests;
export const getOutgoingRequests = impl.getOutgoingRequests;
