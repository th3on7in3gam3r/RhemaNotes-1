# Deprecated — do not use

This `functions/` folder was for Cloudflare **Pages** Functions. Production deploys via **`worker/seo-worker.ts`** only (`wrangler.toml`).

These duplicates are outdated and lack current auth hardening. Safe to delete if you are not using Pages deploy.

Use `worker/seo-worker.ts` as the single API surface.
