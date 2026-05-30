# RhemaNotes

Instant sermon summaries and study tools — record, upload, paste, or link a sermon and get transcripts, scripture links, flashcards, quizzes, and reflections.

## Run locally

**Prerequisites:** Node.js 18+

1. `npm install`
2. Copy `.env.local` and set:
   - `GEMINI_API_KEY` — [Google AI Studio](https://aistudio.google.com/)
   - `VITE_CLERK_PUBLISHABLE_KEY` — Clerk dashboard
   - Optional: `VITE_GEMINI_MODEL` (default `gemini-2.5-flash`)
3. `npm run dev` → http://localhost:3000

Vite proxies `/v1beta` to Google with your local `GEMINI_API_KEY`.

## Smoke test Gemini

```bash
npm run test:gemini
```

## Deploy checklist (Cloudflare Workers)

1. **Build:** `npm run build`
2. **Secrets** (Cloudflare dashboard → Workers → Settings → Variables):
   - `GEMINI_API_KEY` — Google AI (all users share this quota)
   - `CLERK_SECRET_KEY` — **Required** so signed-in users are verified; paid tier (`pro` / `church`) is read from D1 for everyone
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`

   **Build variables** (same dashboard → Build, or local `.env.local` for `npm run build`):
   - `VITE_CLERK_PUBLISHABLE_KEY` — must be present at **build time** (a Worker secret named `VITE_*` does not inject into the JS bundle)
3. **Deploy:** `npx wrangler deploy`
4. **D1:** If the database predates Live Recording, apply migration 001:
   ```bash
   npx wrangler d1 execute rhemanotes-db --remote --file=./database/migrations/001_add_live_source_type.sql
   ```
   See [database/migrations/README.md](database/migrations/README.md).
5. **Smoke test production:**
   - Home loads
   - Sign in (Clerk)
   - Short live recording → Complete Scribing → review transcript → study guide
   - History syncs when signed in

## Live recording flow

1. **Record** — voice memo style
2. **Complete Scribing** — audio is transcribed to plain text (chunked for long sermons)
3. **Review transcript** — confirm before study guide
4. **Study guide** — scriptures, quiz, flashcards, mind map from text

## Project layout

| Path | Purpose |
|------|---------|
| `App.tsx` | Routing & screens |
| `hooks/useSermonProcessing.ts` | Transcribe → review → study guide pipeline |
| `services/geminiService.ts` | Gemini API (proxy, retry, chunking) |
| `worker/seo-worker.ts` | Cloudflare worker: assets, API, Gemini proxy |
| `worker/auth.ts` | Clerk JWT verification |
| `constants/ai.ts` | Model name & limits |
