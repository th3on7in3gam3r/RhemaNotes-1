-- Migration 001: Allow source_type = 'live' on sermons
--
-- SQLite cannot ALTER a CHECK constraint. This rebuilds the sermons table
-- and recreates FTS triggers. Safe to run if the table already includes 'live'
-- (re-run only on empty or backup DBs).
--
-- Apply:
--   npx wrangler d1 execute rhemanotes-db --remote --file=./database/migrations/001_add_live_source_type.sql
-- Local:
--   npx wrangler d1 execute rhemanotes-db --local --file=./database/migrations/001_add_live_source_type.sql

PRAGMA foreign_keys = OFF;

-- Backup (idempotent: drop backup first if re-running after failure)
DROP TABLE IF EXISTS sermons_migration_001_backup;
CREATE TABLE sermons_migration_001_backup AS SELECT * FROM sermons;

CREATE TABLE sermons_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    speaker TEXT,
    date_preached DATETIME,
    source_type TEXT CHECK(source_type IN ('youtube', 'upload', 'text', 'live')) NOT NULL,
    source_url TEXT,
    audio_key TEXT,
    clean_transcript TEXT,
    main_topic TEXT,
    is_public INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    summary_json TEXT
);

INSERT INTO sermons_new SELECT * FROM sermons;

DROP TABLE sermons;

ALTER TABLE sermons_new RENAME TO sermons;

-- Recreate FTS triggers (dropped with old sermons table)
DROP TRIGGER IF EXISTS sermons_ai;
DROP TRIGGER IF EXISTS sermons_ad;
DROP TRIGGER IF EXISTS sermons_au;

CREATE TRIGGER sermons_ai AFTER INSERT ON sermons BEGIN
  INSERT INTO sermons_fts(rowid, id, title, clean_transcript)
  VALUES (new.rowid, new.id, new.title, new.clean_transcript);
END;

CREATE TRIGGER sermons_ad AFTER DELETE ON sermons BEGIN
  INSERT INTO sermons_fts(sermons_fts, rowid, id, title, clean_transcript)
  VALUES ('delete', old.rowid, old.id, old.title, old.clean_transcript);
END;

CREATE TRIGGER sermons_au AFTER UPDATE ON sermons BEGIN
  INSERT INTO sermons_fts(sermons_fts, rowid, id, title, clean_transcript)
  VALUES ('delete', old.rowid, old.id, old.title, old.clean_transcript);
  INSERT INTO sermons_fts(rowid, id, title, clean_transcript)
  VALUES (new.rowid, new.id, new.title, new.clean_transcript);
END;

-- Rebuild full-text index from content table
INSERT INTO sermons_fts(sermons_fts) VALUES ('rebuild');

PRAGMA foreign_keys = ON;
