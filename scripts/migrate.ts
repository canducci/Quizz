// Migrates DATABASE_URL once, as a deploy step: `npm run build && node migrate.mjs`. The Docker box
// migrates at startup instead (instrumentation.ts), but a hosted database is shared by many
// serverless instances that would race to do it. Bundled to migrate.mjs like operator.ts.
import { client, db } from "@/db";
import { migrateDatabase } from "@/db/migrate";

// Unset, @/db falls back to a local file, and the deploy would go live on an unmigrated database.
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set: it's the database this deploy migrates.");
  process.exit(1);
}
await migrateDatabase(client, db);
console.log("Migrated.");
