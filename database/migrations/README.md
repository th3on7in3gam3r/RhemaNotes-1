# D1 migrations

Run against the database named in `wrangler.toml` (`rhemanotes-db`).

## 001 — `live` source type

Adds `live` to the `sermons.source_type` CHECK constraint (required for Live Recording sync).

**Production:**

```bash
npx wrangler d1 execute rhemanotes-db --remote --file=./database/migrations/001_add_live_source_type.sql
```

**Local:**

```bash
npx wrangler d1 execute rhemanotes-db --local --file=./database/migrations/001_add_live_source_type.sql
```

A backup table `sermons_migration_001_backup` is created before the swap. Drop it manually after you verify:

```bash
npx wrangler d1 execute rhemanotes-db --remote --command "DROP TABLE IF EXISTS sermons_migration_001_backup;"
```

**When to skip:** Fresh databases created from `database/schema.sql` after `live` was added already include the constraint.

## 002 — users tier + Stripe columns

Adds `tier`, `stripe_customer_id`, and `stripe_subscription_id` to `users` (required for subscription sync).

**Production:**

```bash
npx wrangler d1 execute rhemanotes-db --remote --file=./database/migrations/002_users_tier_stripe.sql
```

Skip if those columns already exist (e.g. created manually in dashboard).

**Already applied?** If you see `duplicate column name: tier`, production already has these columns — **you are done; do not retry.**

Verify columns:

```bash
npx wrangler d1 execute rhemanotes-db --remote --command "PRAGMA table_info(users);"
```

You should see `tier`, `stripe_customer_id`, and `stripe_subscription_id` in the output.

## 003 — transcription jobs + sermon metadata

Adds `transcription_jobs` table and `bible_reference` / `transcript_status` on `sermons`.

**Production:**

```bash
npx wrangler d1 execute rhemanotes-db --remote --file=./database/migrations/003_transcription_jobs.sql
```

Skip if `transcription_jobs` already exists.
