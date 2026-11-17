CREATE TABLE import_batches (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  collection TEXT NOT NULL CHECK (collection IN ('articles', 'examples')),
  source_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  requested_count INTEGER NOT NULL,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX import_batches_user_date ON import_batches(user_id, created_at, id);
ALTER TABLE articles ADD COLUMN import_batch_id TEXT;
ALTER TABLE examples ADD COLUMN import_batch_id TEXT;
CREATE INDEX articles_import_batch ON articles(user_id, import_batch_id);
CREATE INDEX examples_import_batch ON examples(user_id, import_batch_id);
