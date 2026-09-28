import { isPostgres } from "./dialect";
import * as pg from "./schema.pg";
import * as sqlite from "./schema.sqlite";

// One set of types for both dialects: the app is typed against SQLite's tables, and on Postgres it
// gets the twins in schema.pg.ts, which the drift test keeps column for column alike (ADR 0007).
const tables = (isPostgres() ? pg : sqlite) as unknown as typeof sqlite;

export const {
  user,
  session,
  account,
  verification,
  userRelations,
  sessionRelations,
  accountRelations,
  creator,
  assessment,
  assessmentVersion,
  invite,
  question,
  oneTimeCode,
  emailDay,
  ATTEMPT_OUTCOMES,
  attempt,
  statsDay,
  CERTIFICATE_STATUSES,
  certificate,
} = tables;
export type { AssessmentStatus } from "./schema.sqlite";
