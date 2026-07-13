-- Long-form transcription jobs + sermon metadata columns

ALTER TABLE sermons ADD COLUMN bible_reference TEXT;
ALTER TABLE sermons ADD COLUMN transcript_status TEXT DEFAULT 'pending'
  CHECK(transcript_status IN ('pending', 'processing', 'complete', 'failed'));

CREATE TABLE IF NOT EXISTS transcription_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sermon_id TEXT,
    file_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending', 'processing', 'complete', 'failed')),
    total_chunks INTEGER NOT NULL DEFAULT 0,
    completed_chunks INTEGER NOT NULL DEFAULT 0,
    chunk_transcripts_json TEXT,
    raw_transcript TEXT,
    cleaned_transcript TEXT,
    sermon_title TEXT,
    bible_reference TEXT,
    formatted_transcript TEXT,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_user ON transcription_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_status ON transcription_jobs(status);
