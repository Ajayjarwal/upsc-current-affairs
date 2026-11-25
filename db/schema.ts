import { sqliteTable, text, primaryKey, integer, index } from 'drizzle-orm/sqlite-core';
export const articles = sqliteTable('articles', {
  id: text('id').notNull(), userId: text('user_id').notNull(), data: text('data').notNull(),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
  importBatchId: text('import_batch_id'),
}, t => [primaryKey({columns:[t.userId,t.id]}), index('articles_import_batch').on(t.userId,t.importBatchId)]);

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
  importBatchId: text('import_batch_id'),
}, t => [primaryKey({columns:[t.userId,t.id]}), index('examples_import_batch').on(t.userId,t.importBatchId)]);

export const importBatches = sqliteTable('import_batches', {
  id: text('id').notNull(), userId: text('user_id').notNull(),
  collection: text('collection', {enum:['articles','examples']}).notNull(),
  sourceName: text('source_name').notNull(), createdAt: text('created_at').notNull(),
  requestedCount: integer('requested_count').notNull(), insertedCount: integer('inserted_count').notNull().default(0),
}, t => [primaryKey({columns:[t.userId,t.id]}), index('import_batches_user_date').on(t.userId,t.createdAt,t.id)]);

export const noteVersions = sqliteTable('note_versions', {
 id: integer('id').primaryKey({autoIncrement:true}), userId:text('user_id').notNull(),
 collection:text('collection').notNull(), entryId:text('entry_id').notNull(), data:text('data').notNull(),
 savedAt:text('saved_at').notNull(), archivedAt:text('archived_at').notNull(),
}, t=>[index('note_versions_entry').on(t.userId,t.collection,t.entryId,t.id)]);
