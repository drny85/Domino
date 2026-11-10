import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Abandoned rooms would otherwise stay in the database forever.
crons.hourly("remove idle rooms", { minuteUTC: 17 }, internal.games.cleanupRooms, {});

export default crons;
