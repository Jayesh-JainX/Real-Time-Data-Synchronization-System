### Engineering notes

- Last-sync high water mark is tracked per collection in `sync_state`. First run (no state) treats everything as changed and equalizes both sides.
- Change detection is timestamp-based (`updated_at`) plus soft delete timestamp (`deleted_at`). Clock skew is mitigated by last-writer-wins policy when enabled. For strict correctness across machines, consider using server-generated logical clocks or db triggers.
- Conflict resolution supports three strategies. `latest_wins` compares `updated_at`, then `version` as a tie-breaker, then `id` to stabilize merges.
- Deletions: represented by `deleted_at != NULL`. Sync propagates deletions as normal updates; we don't hard-delete automatically to avoid resurrecting records and to preserve history.
- Direction modes: `overwrite_*` are forceful copy strategies that ignore the last-sync watermark; intended for recovery or bootstrap.
- Schema: tables are auto-created and indexed on `updated_at` and `deleted_at` for faster scans.
- Transactions: Each upsert is atomic. For higher assurance in larger batches, group per-collection pass in a transaction.
