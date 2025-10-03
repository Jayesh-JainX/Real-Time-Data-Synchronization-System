import { ConflictPolicy, ItemRow } from "./types.js";

export function pickWinner(a: ItemRow, b: ItemRow, policy: ConflictPolicy): ItemRow {
  switch (policy) {
    case "prefer_local":
      return a;
    case "prefer_cloud":
      return b;
    case "latest_wins":
    default:
      // Compare updated_at first, then version as tie-breaker, then lexicographic id for determinism
      if (a.updated_at !== b.updated_at) {
        return a.updated_at > b.updated_at ? a : b;
      }
      if (a.version !== b.version) {
        return a.version > b.version ? a : b;
      }
      return a.id <= b.id ? a : b;
  }
}

export function isDeleted(r: ItemRow | undefined): boolean {
  return !!(r && r.deleted_at);
} 