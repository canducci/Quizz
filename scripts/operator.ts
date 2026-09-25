// The Operator's CLI: `npm run operator -- ban <creator email>`, inside the app container with
// `docker compose exec app`. Bundled to operator.mjs at build time with everything but
// @libsql/client, the one dependency the standalone image ships as a package.
import { db } from "@/db";
import { banCreator } from "@/server/creators";

const [command, email] = process.argv.slice(2);
if (command !== "ban" || !email) {
  console.error("Usage: npm run operator -- ban <creator email>");
  process.exit(2);
}

// ponytail: the app's write queue is per process, so this one retries a busy database a few times.
for (let tries = 1; ; tries++) {
  try {
    const done = await banCreator(db, email);
    if (!done) {
      console.error(`No Creator signs in with ${email}. A deleted account can't be banned.`);
      process.exit(1);
    }
    console.log(`Banned ${email}: ${done.revoked} Certificate(s) revoked.`);
    process.exit(0);
  } catch (e) {
    if (tries === 5 || !String(e).includes("SQLITE_BUSY")) throw e;
    await new Promise((r) => setTimeout(r, 500 * tries));
  }
}
