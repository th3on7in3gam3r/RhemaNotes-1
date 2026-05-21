-- ── RhemaNotes D1 Schema ──────────────────────────────────────────────────────

-- Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- Sermons
CREATE TABLE IF NOT EXISTS sermons (
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

-- Study Resources
CREATE TABLE IF NOT EXISTS sermon_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sermon_id TEXT NOT NULL,
    content TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    FOREIGN KEY (sermon_id) REFERENCES sermons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scriptures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sermon_id TEXT NOT NULL,
    reference TEXT NOT NULL,
    context_snippet TEXT,
    FOREIGN KEY (sermon_id) REFERENCES sermons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sermon_id TEXT NOT NULL,
    question TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    options_json TEXT NOT NULL,
    FOREIGN KEY (sermon_id) REFERENCES sermons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reflections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sermon_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sermon_id) REFERENCES sermons(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Full Text Search ─────────────────────────────────────────────────────────

CREATE VIRTUAL TABLE IF NOT EXISTS sermons_fts USING fts5(
    id UNINDEXED, 
    title, 
    clean_transcript,
    content='sermons',
    content_rowid='id'
);

-- Triggers
CREATE TRIGGER IF NOT EXISTS sermons_ai AFTER INSERT ON sermons BEGIN
  INSERT INTO sermons_fts(rowid, id, title, clean_transcript) VALUES (new.rowid, new.id, new.title, new.clean_transcript);
END;

CREATE TRIGGER IF NOT EXISTS sermons_ad AFTER DELETE ON sermons BEGIN
  INSERT INTO sermons_fts(sermons_fts, rowid, id, title, clean_transcript) VALUES('delete', old.rowid, old.id, old.title, old.clean_transcript);
END;

CREATE TRIGGER IF NOT EXISTS sermons_au AFTER UPDATE ON sermons BEGIN
  INSERT INTO sermons_fts(sermons_fts, rowid, id, title, clean_transcript) VALUES('delete', old.rowid, old.id, old.title, old.clean_transcript);
  INSERT INTO sermons_fts(rowid, id, title, clean_transcript) VALUES (new.rowid, new.id, new.title, new.clean_transcript);
END;
