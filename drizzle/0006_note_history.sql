CREATE TABLE note_versions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL,
 collection TEXT NOT NULL CHECK(collection IN ('articles','examples')),
 entry_id TEXT NOT NULL,
 data TEXT NOT NULL,
 saved_at TEXT NOT NULL,
 archived_at TEXT NOT NULL
);
CREATE INDEX note_versions_entry ON note_versions(user_id,collection,entry_id,id);
CREATE TRIGGER articles_version_before_update BEFORE UPDATE OF data ON articles
WHEN OLD.data != NEW.data
BEGIN
 INSERT INTO note_versions(user_id,collection,entry_id,data,saved_at,archived_at)
 VALUES(OLD.user_id,'articles',OLD.id,OLD.data,OLD.updated_at,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER examples_version_before_update BEFORE UPDATE OF data ON examples
WHEN OLD.data != NEW.data
BEGIN
 INSERT INTO note_versions(user_id,collection,entry_id,data,saved_at,archived_at)
 VALUES(OLD.user_id,'examples',OLD.id,OLD.data,OLD.updated_at,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER articles_versions_after_delete AFTER DELETE ON articles
BEGIN DELETE FROM note_versions WHERE user_id=OLD.user_id AND collection='articles' AND entry_id=OLD.id; END;
CREATE TRIGGER examples_versions_after_delete AFTER DELETE ON examples
BEGIN DELETE FROM note_versions WHERE user_id=OLD.user_id AND collection='examples' AND entry_id=OLD.id; END;
