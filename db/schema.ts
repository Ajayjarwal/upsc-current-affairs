import { sqliteTable, text, primaryKey, integer, index } from 'drizzle-orm/sqlite-core';
export const articles = sqliteTable('articles', {
  id: text('id').notNull(), userId: text('user_id').notNull(), data: text('data').notNull(),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [primaryKey({columns:[t.userId,t.id]})]);

export const authSessions = sqliteTable('auth_sessions', {
  sessionHash: text('session_hash').primaryKey(),
  userId: text('user_id').notNull(),
  username: text('username').notNull(),
  email: text('email').notNull().default(''),
  displayName: text('display_name').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, t => [index('auth_sessions_expiry').on(t.expiresAt)]);

export const authOauthStates = sqliteTable('auth_oauth_states', {
  stateHash: text('state_hash').primaryKey(),
  verifier: text('verifier').notNull(),
  returnTo: text('return_to').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, t => [index('auth_oauth_states_expiry').on(t.expiresAt)]);

// Keep the earlier table in the migration history; only Google state is used now.
export const authGoogleOauthStates = sqliteTable('auth_google_oauth_states', {
  stateHash: text('state_hash').primaryKey(),
  verifier: text('verifier').notNull(),
  nonce: text('nonce').notNull(),
  returnTo: text('return_to').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, t => [index('auth_google_oauth_states_expiry').on(t.expiresAt)]);

// Examples are independent of the current affairs collection.
export const examples = sqliteTable('examples', {
  id: text('id').notNull(), userId: text('user_id').notNull(), data: text('data').notNull(),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [primaryKey({columns:[t.userId,t.id]})]);
