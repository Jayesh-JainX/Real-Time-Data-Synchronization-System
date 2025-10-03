import { Database } from "sqlite";

export async function inTransaction<T>(db: Database, fn: () => Promise<T>): Promise<T> {
  await db.exec("BEGIN");
  try {
    const result = await fn();
    await db.exec("COMMIT");
    return result;
  } catch (err) {
    await db.exec("ROLLBACK");
    throw err;
  }
} 