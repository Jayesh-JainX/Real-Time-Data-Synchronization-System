import cron from "node-cron";
import { ScheduleConfig } from "./types.js";

export type ScheduledHandle = { cancel: () => void };

export function scheduleTask(schedule: ScheduleConfig, task: () => void): ScheduledHandle {
  if (schedule.type === "interval") {
    const h = setInterval(task, schedule.everySeconds * 1000);
    return { cancel: () => clearInterval(h) };
  }
  const job = cron.schedule(schedule.expression, task, { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  job.start();
  return { cancel: () => job.stop() };
} 