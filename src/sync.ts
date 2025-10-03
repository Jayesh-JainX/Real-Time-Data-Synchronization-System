import { Database } from "sqlite";
import { CollectionConfig, ItemRow } from "./types.js";
import { ensureCollectionTables, getById, getChangedSince, getLastSyncAt, setLastSyncAt, upsertRow } from "./db.js";
import { pickWinner, isDeleted } from "./conflicts.js";

function nowIso(): string {
  return new Date().toISOString();
}

function cloneRow(r: ItemRow): ItemRow {
  return { ...r };
}

export async function syncCollection(db: Database, coll: CollectionConfig): Promise<void> {
  await ensureCollectionTables(db, coll.localTable, coll.cloudTable);

  const lastSyncAt = await getLastSyncAt(db, coll.name);

  const [localChanges, cloudChanges] = await Promise.all([
    getChangedSince(db, coll.localTable, lastSyncAt),
    getChangedSince(db, coll.cloudTable, lastSyncAt),
  ]);

  // Derive the set of ids that changed on either side
  const changedIds = new Set<string>();
  for (const r of localChanges) changedIds.add(r.id);
  for (const r of cloudChanges) changedIds.add(r.id);

  for (const id of changedIds) {
    const [localRow, cloudRow] = await Promise.all([
      getById(db, coll.localTable, id),
      getById(db, coll.cloudTable, id),
    ]);

    // Determine if each side changed since last sync by consulting the change lists for faster checks
    const localChanged = localChanges.find((r) => r.id === id);
    const cloudChanged = cloudChanges.find((r) => r.id === id);

    // Respect direction settings up-front
    if (coll.direction === "l2c") {
      await propagateLocalToCloud(db, coll, localRow, cloudRow, !!localChanged);
    } else if (coll.direction === "c2l") {
      await propagateCloudToLocal(db, coll, localRow, cloudRow, !!cloudChanged);
    } else if (coll.direction === "overwrite_local") {
      // Cloud is source of truth; copy to local regardless of local changes
      if (cloudRow) {
        await upsertRow(db, coll.localTable, cloneRow(cloudRow));
      }
    } else if (coll.direction === "overwrite_cloud") {
      // Local is source of truth
      if (localRow) {
        await upsertRow(db, coll.cloudTable, cloneRow(localRow));
      }
    } else {
      // both
      await resolveBothWays(db, coll, localRow, cloudRow, !!localChanged, !!cloudChanged);
    }
  }

  // Advance the high-water mark only after the pass completes
  await setLastSyncAt(db, coll.name, nowIso());
}

async function propagateLocalToCloud(db: Database, coll: CollectionConfig, localRow?: ItemRow, cloudRow?: ItemRow, localChanged?: boolean) {
  if (!localRow) return; // nothing to push
  if (!localChanged) return; // only sync when local changed to avoid thrashing

  if (isDeleted(localRow)) {
    await upsertRow(db, coll.cloudTable, localRow);
    return;
  }
  await upsertRow(db, coll.cloudTable, localRow);
}

async function propagateCloudToLocal(db: Database, coll: CollectionConfig, localRow?: ItemRow, cloudRow?: ItemRow, cloudChanged?: boolean) {
  if (!cloudRow) return;
  if (!cloudChanged) return;

  if (isDeleted(cloudRow)) {
    await upsertRow(db, coll.localTable, cloudRow);
    return;
  }
  await upsertRow(db, coll.localTable, cloudRow);
}

async function resolveBothWays(
  db: Database,
  coll: CollectionConfig,
  localRow?: ItemRow,
  cloudRow?: ItemRow,
  localChanged?: boolean,
  cloudChanged?: boolean
) {
  // No data on either side - nothing to do
  if (!localRow && !cloudRow) return;

  // Created on local only
  if (localRow && !cloudRow) {
    await upsertRow(db, coll.cloudTable, cloneRow(localRow));
    return;
  }
  // Created on cloud only
  if (cloudRow && !localRow) {
    await upsertRow(db, coll.localTable, cloneRow(cloudRow));
    return;
  }

  // Both exist
  if (!localRow || !cloudRow) return; // type narrow

  // If only one side changed, propagate that side
  if (localChanged && !cloudChanged) {
    await upsertRow(db, coll.cloudTable, cloneRow(localRow));
    return;
  }
  if (cloudChanged && !localChanged) {
    await upsertRow(db, coll.localTable, cloneRow(cloudRow));
    return;
  }

  // Both changed -> conflict
  const winner = pickWinner(localRow, cloudRow, coll.conflictPolicy);
  const loser = winner === localRow ? cloudRow : localRow;

  // If winner represents a deletion, propagate deletion record
  if (isDeleted(winner)) {
    await Promise.all([
      upsertRow(db, coll.localTable, cloneRow(winner)),
      upsertRow(db, coll.cloudTable, cloneRow(winner)),
    ]);
    return;
  }

  // Winner is an update. Bump version to reflect merge
  const merged: ItemRow = { ...winner, version: Math.max(localRow.version, cloudRow.version) + 1, updated_at: new Date().toISOString() };

  await Promise.all([
    upsertRow(db, coll.localTable, cloneRow(merged)),
    upsertRow(db, coll.cloudTable, cloneRow(merged)),
  ]);
} 