export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { secretsProblem } = await import("./server/env");
  const problem = secretsProblem();
  if (problem) {
    console.error(problem);
    process.exit(1);
  }

  const { db } = await import("./db");
  const { migrateDatabase } = await import("./db/migrate");
  await migrateDatabase(db);

  const { ensureBucket } = await import("./server/files");
  await ensureBucket();

  const { startSweep } = await import("./server/sweep");
  startSweep(db);
}
