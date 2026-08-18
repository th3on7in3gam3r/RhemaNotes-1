# Long-form sermon transcription

Chunked Whisper pipeline for recordings **15+ minutes**.

## Flow

1. **Client** splits audio into ~10-minute WAV segments with **15s overlap** (Web Audio API).
2. **Worker** transcribes each chunk via Whisper with a sermon-specific prompt.
3. **Worker** stitches chunks (overlap dedup), cleans transcript via **Gemini**, extracts title & scripture.
4. **D1** stores job status in `transcription_jobs`; sermons get `bible_reference` + `transcript_status`.

## Architecture notes

| Request | Reality in RhemaNotes |
|---------|----------------------|
| ffmpeg chunking | **Web Audio API** on the client — Cloudflare Workers cannot run ffmpeg. For true ffmpeg, add R2 + external transcode (Render, Fly, etc.). |
| Inngest background jobs | **No Inngest.** Jobs use D1 + `ctx.waitUntil()` on the Worker. Client must upload all chunks; finalize runs server-side after last chunk. |
| Claude cleanup | **Gemini** (`worker/transcriptCleanup.ts`) with the same editorial rules. Swap to Anthropic when `ANTHROPIC_API_KEY` is added. |
| Close tab during transcribe | Partial: after all chunks are uploaded, cleanup continues via `waitUntil`. Mid-upload still requires the tab. **R2 + Queue** would enable full fire-and-forget. |

## API

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/transcribe/jobs` | Create job `{ fileName, totalChunks }` |
| POST | `/api/transcribe/jobs/:id/chunks/:index` | Upload + transcribe one chunk |
| GET | `/api/transcribe/jobs/:id` | Poll status / result |

## Migration

```bash
npx wrangler d1 execute rhemanotes-db --remote --file=./database/migrations/003_transcription_jobs.sql
```

## Output format

```markdown
# [Sermon Title or "Sermon Transcript"]
**Scripture: [Bible Reference]**
---
[cleaned transcript]
```

Stored in `transcription_jobs.formatted_transcript` and `cleaned_transcript` on the job row.
