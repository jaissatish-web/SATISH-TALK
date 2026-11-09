import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval(
  "remove expired presence, leases and signals",
  { seconds: 30 },
  internal.maintenance.sweep,
  {},
);
export default crons;
