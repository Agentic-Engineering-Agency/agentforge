import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Cron Scheduler Configuration
 *
 * This file defines all scheduled tasks (crons) for AgentForge.
 * Cron jobs are executed by Convex at the specified intervals.
 *
 * Current scheduled tasks:
 * - "run-due-cron-jobs": Executes all due cron jobs every minute
 */

const crons = cronJobs();

// Execute due cron jobs every minute
crons.interval(
  "run-due-cron-jobs",
  { minutes: 1 },
  internal.cronJobs.executeDueJobs
);

export default crons;
