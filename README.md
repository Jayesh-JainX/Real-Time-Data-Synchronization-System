### A Near Real-Time / Configurable Data Synchronization System

This project simulates syncing data between a "local" client and a "cloud" server using two tables in the same SQLite database file. It supports two-way sync, per-direction modes, simple conflict resolution, soft deletions, and configurable scheduling (interval or cron).

### What it does

- Identifies rows changed since the last sync and moves them between `local_*` and `cloud_*` tables
- Handles both directions (local→cloud, cloud→local) or one-way only
- Resolves conflicts with a policy: `latest_wins`, `prefer_local`, or `prefer_cloud`
- Tracks deletions via `deleted_at` (soft delete) and propagates them
- Runs once or on a schedule (`interval` seconds or standard 5-part cron)

### Quick start

1. Install Node.js 18+.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build and run a demo:
   ```bash
   npm run build
   node dist/index.js --demo
   ```
   - This seeds a few rows and starts the scheduler (if configured). You can also run a single pass:
   ```bash
   npx ts-node src/index.ts --once
   ```

### Configuration

The app reads `config.json` in the project root. If it doesn't exist, one is created with sane defaults.

Example:

```json
{
  "databaseFile": "data.sqlite",
  "schedule": { "type": "interval", "everySeconds": 20 },
  "collections": [
    {
      "name": "items",
      "localTable": "local_items",
      "cloudTable": "cloud_items",
      "direction": "both",
      "conflictPolicy": "latest_wins"
    }
  ]
}
```

- `direction` can be:
  - `l2c`: only sync local changes to cloud
  - `c2l`: only sync cloud changes to local
  - `both`: bidirectional sync
  - `overwrite_local`: copy cloud → local every run (cloud is source of truth)
  - `overwrite_cloud`: copy local → cloud every run (local is source of truth)
- `conflictPolicy` can be `latest_wins`, `prefer_local`, or `prefer_cloud`.
- `schedule` can be omitted to run once and exit. You can also set a cron expression:

```json
{ "type": "cron", "expression": "*/1 * * * *" }
```

### Data model

Each table uses the same schema:

- `id TEXT PRIMARY KEY`
- `name TEXT`
- `quantity INTEGER`
- `updated_at TEXT` (ISO timestamp)
- `deleted_at TEXT | NULL` (when set, record is considered deleted)
- `version INTEGER` (monotonically increasing)

### Conflict handling

When a record changed on both sides since the last run, the system picks a winner using the configured policy. For `latest_wins`, it compares `updated_at`, then `version`, then `id` as a final deterministic tie-breaker. The winner overwrites both sides, and its `version` is bumped.

### Soft deletes

Set `deleted_at` to an ISO timestamp to mark a record as deleted. Deletions are treated as changes and propagated. Hard deletes are not used during sync to preserve history, but utility exists in code.

### Dev notes

- The DB schema is created automatically on startup.
- A tiny seed script lives in `src/scripts/seed.ts`.
- The project uses SQLite via `sqlite3` and runs on Node 18+ with ESM TypeScript.

### Useful commands

```bash
# Build and start (scheduled)
npm run build && npm start

# Run one sync pass
npx ts-node src/index.ts --once

# Seed demo data and run once
npx ts-node src/scripts/seed.ts
npx ts-node src/index.ts --once
```
