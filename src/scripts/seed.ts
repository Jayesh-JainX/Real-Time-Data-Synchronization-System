import { openDatabase, ensureCollectionTables, upsertRow } from "../db.js";
import { ItemRow } from "../types.js";
import crypto from "crypto";

function isoNow() {
  return new Date().toISOString();
}

function makeItem(name: string, quantity: number): ItemRow {
  const now = isoNow();
  return {
    id: crypto.randomUUID(),
    name,
    quantity,
    updated_at: now,
    deleted_at: null,
    version: 1,
  };
}

export async function seedDemoData(dbFile: string) {
  const db = await openDatabase(dbFile);
  await ensureCollectionTables(db, "local_items", "cloud_items");

  const a = makeItem("Apples", 5);
  const b = makeItem("Bananas", 12);
  const c = makeItem("Carrots", 9);

  // initial on local
  await upsertRow(db, "local_items", a);
  await upsertRow(db, "local_items", b);

  // one only on cloud
  await upsertRow(db, "cloud_items", c);

  console.log("Seeded demo data:", { local: [a.name, b.name], cloud: [c.name] });
}

if (process.argv[1]?.endsWith("seed.ts")) {
  const dbFile = process.argv[2] || "data.sqlite";
  seedDemoData(dbFile).then(() => process.exit(0));
} 