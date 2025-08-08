import fs from "fs";
import path from "path";
import { AppConfig, CollectionConfig } from "./types.js";

const DEFAULT_DB_FILE = "data.sqlite";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function loadConfig(configPath = path.resolve("config.json")): AppConfig {
  if (!fs.existsSync(configPath)) {
    // Create a starter config if none exists to help first run
    const starter: AppConfig = {
      databaseFile: DEFAULT_DB_FILE,
      collections: [
        {
          name: "items",
          localTable: "local_items",
          cloudTable: "cloud_items",
          direction: "both",
          conflictPolicy: "latest_wins",
        },
      ],
    };
    fs.writeFileSync(configPath, JSON.stringify(starter, null, 2));
    return starter;
  }
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw) as AppConfig;

  // Basic validation
  assert(typeof parsed.databaseFile === "string" && parsed.databaseFile.length > 0, "config.databaseFile must be a non-empty string");
  assert(Array.isArray(parsed.collections) && parsed.collections.length > 0, "config.collections must be a non-empty array");

  parsed.collections.forEach(validateCollection);

  if (parsed.schedule) {
    if (parsed.schedule.type === "interval") {
      assert(parsed.schedule.everySeconds > 0, "schedule.everySeconds must be > 0");
    } else if (parsed.schedule.type === "cron") {
      assert(typeof parsed.schedule.expression === "string" && parsed.schedule.expression.length > 0, "schedule.expression must be a non-empty string");
    } else {
      throw new Error("schedule.type must be 'interval' or 'cron'");
    }
  }

  return parsed;
}

function validateCollection(coll: CollectionConfig) {
  assert(coll.name && coll.name.trim().length > 0, "collection.name is required");
  assert(coll.localTable && coll.localTable.trim().length > 0, "collection.localTable is required");
  assert(coll.cloudTable && coll.cloudTable.trim().length > 0, "collection.cloudTable is required");
  const directions = new Set(["l2c", "c2l", "both", "overwrite_local", "overwrite_cloud"]);
  assert(directions.has(coll.direction), "collection.direction must be one of l2c|c2l|both|overwrite_local|overwrite_cloud");
  const policies = new Set(["latest_wins", "prefer_local", "prefer_cloud"]);
  assert(policies.has(coll.conflictPolicy), "collection.conflictPolicy must be one of latest_wins|prefer_local|prefer_cloud");
} 