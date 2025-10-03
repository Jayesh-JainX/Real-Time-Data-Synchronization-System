import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import path from "path";
import { ItemRow } from "./types.js";

sqlite3.verbose();

export async function openDatabase(dbFile: string): Promise<Database> {
  const db = await open({
    filename: path.resolve(dbFile),
    driver: sqlite3.Database,
  });
  await ensureSchema(db);
  return db;
}

async function ensureSchema(db: Database): Promise<void> {
  // sync_state tracks when we last completed a sync pass per collection (global high-water mark)
  await db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sync_state (
      entity TEXT PRIMARY KEY,
      last_sync_at TEXT NOT NULL
    );
  `);
}

export async function ensureCollectionTables(db: Database, localTable: string, cloudTable: string): Promise<void> {
  const create = async (tbl: string) => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ${tbl} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        version INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_${tbl}_updated ON ${tbl}(updated_at);
      CREATE INDEX IF NOT EXISTS idx_${tbl}_deleted ON ${tbl}(deleted_at);
    `);
  };
  await create(localTable);
  await create(cloudTable);
}

export async function getLastSyncAt(db: Database, entity: string): Promise<string | null> {
  const row = await db.get<{ last_sync_at: string }>(`SELECT last_sync_at FROM sync_state WHERE entity = ?`, entity);
  return row ? row.last_sync_at : null;
}

export async function setLastSyncAt(db: Database, entity: string, isoTime: string): Promise<void> {
  await db.run(
    `INSERT INTO sync_state(entity, last_sync_at) VALUES(?, ?)
     ON CONFLICT(entity) DO UPDATE SET last_sync_at = excluded.last_sync_at`,
    entity,
    isoTime
  );
}

export async function getChangedSince(db: Database, table: string, sinceIso: string | null): Promise<ItemRow[]> {
  if (!sinceIso) {
    // First sync: consider everything as changed
    const rows = await db.all<ItemRow[]>(`SELECT * FROM ${table}`);
    return rows as unknown as ItemRow[];
  }
  const rows = await db.all<ItemRow[]>(
    `SELECT * FROM ${table} WHERE updated_at > ? OR (deleted_at IS NOT NULL AND deleted_at > ?)`,
    sinceIso,
    sinceIso
  );
  return rows as unknown as ItemRow[];
}

export async function getById(db: Database, table: string, id: string): Promise<ItemRow | undefined> {
  const row = await db.get<ItemRow>(`SELECT * FROM ${table} WHERE id = ?`, id);
  return row as unknown as ItemRow | undefined;
}

export async function upsertRow(db: Database, table: string, row: ItemRow): Promise<void> {
  await db.run(
    `INSERT INTO ${table}(id, name, quantity, updated_at, deleted_at, version)
     VALUES(?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       quantity = excluded.quantity,
       updated_at = excluded.updated_at,
       deleted_at = excluded.deleted_at,
       version = excluded.version
    `,
    row.id,
    row.name,
    row.quantity,
    row.updated_at,
    row.deleted_at,
    row.version
  );
}

export async function hardDelete(db: Database, table: string, id: string): Promise<void> {
  await db.run(`DELETE FROM ${table} WHERE id = ?`, id);
} 