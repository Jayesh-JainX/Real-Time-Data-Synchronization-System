export type Direction = "l2c" | "c2l" | "both" | "overwrite_local" | "overwrite_cloud";
export type ConflictPolicy = "latest_wins" | "prefer_local" | "prefer_cloud";

export interface CollectionConfig {
  name: string;
  localTable: string;
  cloudTable: string;
  direction: Direction;
  conflictPolicy: ConflictPolicy;
}

export interface ScheduleConfigInterval {
  type: "interval";
  everySeconds: number; // > 0
}

export interface ScheduleConfigCron {
  type: "cron";
  expression: string; // standard 5-part cron
}

export type ScheduleConfig = ScheduleConfigInterval | ScheduleConfigCron;

export interface AppConfig {
  databaseFile: string; // path to sqlite db file
  schedule?: ScheduleConfig; // if missing, run once and exit
  collections: CollectionConfig[];
}

export interface ItemRow {
  id: string;
  name: string;
  quantity: number;
  updated_at: string; // ISO
  deleted_at: string | null;
  version: number; // incrementing integer
}

export interface SyncStateRow {
  entity: string; // collection name
  last_sync_at: string; // ISO
} 