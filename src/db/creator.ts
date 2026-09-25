import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { v7 as uuidv7 } from "uuid";
import * as schema from "./schema";

/** Signing in makes the person a Creator. Runs on every sign-in, so a failed first try heals. */
export async function ensureCreator(db: LibSQLDatabase<typeof schema>, authUserId: string) {
  const [user] = await db.select().from(schema.user).where(eq(schema.user.id, authUserId));
  if (!user) return;
  await db
    .insert(schema.creator)
    .values({ id: uuidv7(), authUserId, name: user.name, joinedAt: new Date() })
    .onConflictDoNothing({ target: schema.creator.authUserId });
}
