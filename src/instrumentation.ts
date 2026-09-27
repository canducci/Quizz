export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { secretsProblem } = await import("./server/env");
  const problem = secretsProblem();
  if (problem) {
    console.error(problem);
    process.exit(1);
  }

  // A local file means the self-hosted box (ADR 0005): one process, Silo beside it. A hosted
  // database means serverless (Netlify): the deploy migrates (scripts/migrate.ts), the bucket is
  // made by hand, and a scheduled function sweeps (netlify/functions/sweep.mts).
  const { client, db } = await import("./db");
  if (client.protocol !== "file") return;

  const { migrateDatabase } = await import("./db/migrate");
  await migrateDatabase(client, db);

  const { ensureBucket } = await import("./server/files");
  await ensureBucket();

  const { startSweep } = await import("./server/sweep");
  startSweep(db);
}
