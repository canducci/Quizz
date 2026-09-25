// The Operator's CLI: `npm run operator -- ban <creator email>`, inside the app container with
// `docker compose exec app`. Bundled to operator.mjs at build time with everything but
// @libsql/client, the one dependency the standalone image ships as a package.
import { client, db } from "@/db";
import { banCreator } from "@/server/creators";

const [command, email] = process.argv.slice(2);
if (command !== "ban" || !email) {
  console.error("Usage: npm run operator -- ban <creator email>");
  process.exit(2);
}

// The app's write queue is per process: this one waits out the app's lock instead of failing
// SQLITE_BUSY. The pragma is SQLite-only, like the WAL one in migrate.ts; drop it with SQLite.
await client.execute("pragma busy_timeout = 5000");
const done = await banCreator(db, email);
if (!done) {
  console.error(`No Creator signs in with ${email}. A deleted account can't be banned.`);
  process.exit(1);
}
console.log(`Banned ${email}: ${done.revoked} Certificate(s) revoked.`);
