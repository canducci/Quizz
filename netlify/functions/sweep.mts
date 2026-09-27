// On Netlify the in-process hourly timer (startSweep) never runs; this scheduled function does its
// job. Netlify won't serve a scheduled function over HTTP in production, so it needs no secret.
import { db } from "../../src/db";
import { sweep } from "../../src/server/sweep";

export default async function hourlySweep() {
  await sweep(db);
}

export const config = { schedule: "@hourly" };
