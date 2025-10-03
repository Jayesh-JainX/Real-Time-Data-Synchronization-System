import { openDatabase, upsertRow } from "../db.js";
import { ItemRow } from "../types.js";

export async function updateQuantity(dbFile: string, table: string, id: string, qty: number) {
  const db = await openDatabase(dbFile);
  const row = (await db.get<ItemRow>(`SELECT * FROM ${table} WHERE id = ?`, id)) as ItemRow | undefined;
  if (!row) throw new Error(`No row ${id} in ${table}`);
  const now = new Date().toISOString();
  row.quantity = qty;
  row.updated_at = now;
  row.version += 1;
  await upsertRow(db, table, row);
  console.log(`Updated ${table}.${id} -> quantity=${qty}`);
}

export async function softDelete(dbFile: string, table: string, id: string) {
  const db = await openDatabase(dbFile);
  const row = (await db.get<ItemRow>(`SELECT * FROM ${table} WHERE id = ?`, id)) as ItemRow | undefined;
  if (!row) throw new Error(`No row ${id} in ${table}`);
  const now = new Date().toISOString();
  row.deleted_at = now;
  row.updated_at = now;
  row.version += 1;
  await upsertRow(db, table, row);
  console.log(`Soft-deleted ${table}.${id}`);
} 