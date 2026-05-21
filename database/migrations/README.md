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
