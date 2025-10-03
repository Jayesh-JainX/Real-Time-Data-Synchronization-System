import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db.js";
import { scheduleTask } from "./scheduler.js";
import { syncCollection } from "./sync.js";
import type { ScheduleConfigCron, ScheduleConfigInterval } from "./types.js";

async function run() {
  const argv = await yargs(hideBin(process.argv))
    .option("once", { type: "boolean", describe: "Run one sync pass and exit" })
    .option("demo", { type: "boolean", describe: "Seed demo data then start scheduled sync" })
    .help()
    .parse();

  const config = loadConfig();
  const db = await openDatabase(config.databaseFile);

  if (argv.demo) {
    const { seedDemoData } = await import("./scripts/seed.js");
    await seedDemoData(config.databaseFile);
  }

  const runPass = async () => {
    for (const coll of config.collections) {
      try {
        await syncCollection(db, coll);
        console.log(`[${new Date().toISOString()}] synced collection '${coll.name}' (${coll.direction}, ${coll.conflictPolicy})`);
      } catch (err) {
        console.error(`sync failed for '${coll.name}':`, err);
      }
    }
  };

  if (argv.once || !config.schedule) {
    await runPass();
    process.exit(0);
  }

  // Scheduled mode
  if (config.schedule.type === "interval") {
    const s = config.schedule as ScheduleConfigInterval;
    console.log(`Starting scheduler (every ${s.everySeconds}s)`);
  } else {
    const s = config.schedule as ScheduleConfigCron;
    console.log(`Starting scheduler (cron ${s.expression})`);
  }
  await runPass(); // run immediately
  scheduleTask(config.schedule, () => {
    runPass();
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
}); 