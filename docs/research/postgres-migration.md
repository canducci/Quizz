# Supporting Postgres alongside SQLite

Status: implemented; see ADR 0007 for the decisions that stuck.

This investigation is based on `main` at d895807. It changes no code.

**Decisions:**
- **Support both** SQLite (libsql) and Postgres.
- **No existing data** to migrate.
- **Container deployment only**: no Netlify or other serverless hosting, so the `worktree-netlify-deploy` branch isn't a base.

ADRs 0005 and 0006 kept this cheap: every query goes through Drizzle, transactions are async, and the only SQLite-only SQL is the two pragmas. Drizzle has **no cross-dialect schema**. Its docs only offer per-dialect `sqliteTable`/`pgTable`, and each dialect gets its own migration folder and a query builder of its own type. So "both" comes down to three things:
- two schema files with the same TypeScript shape,
- the dialect chosen at runtime from `DATABASE_URL`,
- the app code typed against one of the two schemas.

## Ongoing cost of "both"

- Every schema change is written twice (`schema/sqlite.ts` and `schema/pg.ts`) and generated twice (`drizzle/sqlite`, `drizzle/pg`). A drift test (below) catches a forgotten side.
- Unit tests and e2e run once per dialect in CI.
- Raw SQL (only in tests and e2e seeds) exists once per dialect.

## Design

### Dialect choice

`src/db/index.ts` reads the scheme of `DATABASE_URL`:
- `file:` or `libsql:` means SQLite, and stays the default (`file:./data/quizz.db`).
- `postgres://` or `postgresql://` means Postgres.

There's no separate `DB_DIALECT` variable.

### Schema

```
src/db/schema/sqlite.ts       today's schema.ts, unchanged
src/db/schema/sqlite-auth.ts  today's auth-schema.ts
src/db/schema/pg.ts           pgTable twin
src/db/schema/pg-auth.ts      Better Auth CLI output for pg
src/db/schema.ts              exports the runtime dialect's tables, typed as the SQLite ones
```

Type mapping for the pg twin. Each pair gives the same TypeScript type on both sides, so app code doesn't notice:

| SQLite | Postgres | TS |
|---|---|---|
| `integer({mode:"timestamp_ms"})` | `timestamp({withTimezone:true, mode:"date"})` | `Date` |
| `integer({mode:"boolean"})` | `boolean()` | `boolean` |
| `text({mode:"json"}).$type<T>()` | `jsonb().$type<T>()` | `T` |
| `text({enum})` | `text({enum})` (keeps the migrations simple, no `pgEnum`) | union |
| `integer()` | `integer()` | `number` |

The partial unique index `attempt_running` (`where outcome = 'in_progress'`) and the `onDelete` rules port as they are.

The 27 files that do `import * as schema` stay unchanged, because `schema.ts` keeps its export names. The lie is only in the types: at runtime a pg `db` always receives pg tables, so the builders stay consistent. The pg `db` is cast to the one shared `Db` type (`LibSQLDatabase<typeof sqliteSchema>`). That type is exported from `src/db` and replaces the ~12 local `LibSQLDatabase` aliases.

**Drift guard.** One Vitest test walks both schema modules with `getTableConfig` and compares table names, column names, nullability, primary keys and indexes. A type-level check (`$inferSelect` of each pair are mutually assignable) makes `tsc` fail on type drift.

### Results that differ by dialect

`update`/`delete` without `.returning()` returns a driver-specific result (libsql `rowsAffected`, pg `rowCount`). There are 6 sites: `invites.ts` ×2, `sweep.ts`, `attempts.ts` ×2, `certificates.ts`. Rewrite them as `.returning({ id })` and check `.length`, which works on both dialects and needs no helper. Everything else in use is portable across both:
- `onConflictDoNothing`/`onConflictDoUpdate`,
- `.returning()`,
- `` sql`${col} + 1` ``,
- `count()`/`max()` over integers.

There are no `.get()`/`.all()`/`.run()` calls.

### Transactions: one seam, two strategies

`openDatabase` in `src/db/open.ts` already wraps `db.transaction`, and it is the right place for the dialect difference:

- **SQLite**: keeps today's per-process queue unchanged.
- **Postgres**: no queue. Each transaction runs with `{ isolationLevel: "serializable" }` and is retried on `40001`, and on `23505` from `attempt_running`: 3 tries with jitter.

Why serializable: the queue makes SQLite effectively serializable today, and several paths rely on it. Under Postgres's default READ COMMITTED these race:

| Site | Race | Consequence |
|---|---|---|
| `startAttempt` | two Starts both see "no running Attempt" | the unique index throws 23505. The test "two Starts race" fails. |
| `saveAnswer` | read `answers` JSON, write the whole object back | the same Learner saving two answers at once loses one |
| `verifyCode` | read `wrongTries`, then +1 | parallel guesses exceed `MAX_WRONG` (security) |
| `requestCode` | count, then insert | rate limits exceeded by N (today: by one, noted with `ponytail:`) |
| `publish` | `max(number)+1` | collides on the unique `assessment_version_number` |
| `appendQuestions` | `max(position)+1` | duplicate positions, silently (no unique index) |

Serializable plus retry keeps today's behaviour with one wrapper, and Better Auth's transactions go through it as well. The guarded `UPDATE … WHERE status = …` paths and `bump` (the upsert takes the row lock before the JSON read) would be safe even without it.

ADR 0006's rule "never call `db.transaction` inside one" still applies, because the SQLite queue stays.

### Better Auth

`drizzleAdapter(db, { provider: dialect === "pg" ? "pg" : "sqlite", schema })` in `src/server/auth.ts`.

### Migrations

- Move `drizzle/*` to `drizzle/sqlite/`. Drizzle's journal table stores hashes, not paths, and there's no prior data anyway.
- Generate a `drizzle/pg/0000` baseline.
- Two configs, `drizzle.sqlite.config.ts` and `drizzle.pg.config.ts`. `npm run db:generate` runs both.
- `src/db/migrate.ts` picks the migrator (`drizzle-orm/libsql/migrator` or `drizzle-orm/node-postgres/migrator`) and the folder. The WAL pragma stays on the SQLite branch only.
- Migrating on boot stays as it is: the deployment is one container. An advisory lock is only needed if several app replicas share one Postgres.

### Snapshot comparison

`src/server/publish.ts:37` compares snapshots with `JSON.stringify(a) !== JSON.stringify(b)`. `jsonb` reorders keys (by length, then bytes), so on Postgres every publish would see "changes", create a duplicate Version, and never show "No unpublished changes." The fix is `util.isDeepStrictEqual`. It's correct on both dialects, so there's no branching.

### Operator CLI

`scripts/operator.ts` loses `pragma busy_timeout` on Postgres; keep it only when the URL is SQLite. The esbuild line in `package.json` marks both `@libsql/client` and `pg` as external. Check that the Next standalone output ships `pg` (it traces only what gets imported, and both drivers are imported dynamically by `src/db`).

## Containers

- `Dockerfile`: unchanged apart from both drivers being present. `DATABASE_URL` still defaults to the SQLite file and the `/data` volume.
- `compose.yml`: unchanged (SQLite, zero extra services).
- New `compose.postgres.yml` override: a `postgres:18` service with a volume and a `pg_isready` healthcheck. It sets the app's `DATABASE_URL=postgres://…` and makes the app `depends_on` the service being healthy. Run it with `docker compose -f compose.yml -f compose.postgres.yml up`.
- Backups: the README gets both stories, "copy the SQLite file + bucket" and "`pg_dump` + bucket".

## Tests

- **Vitest.** `src/server/test-db.ts` keeps the temp SQLite file by default. With `TEST_DATABASE_URL=postgres://…` it gives each test its own database: `globalSetup` migrates a template DB once, then each test gets `CREATE DATABASE t_<n> TEMPLATE quizz_template`. **Not PGlite**: it runs on a single connection, so the race tests would pass without racing. Close the pools in `afterAll`.
- **Missing test.** Add a same-Learner concurrent `saveAnswer` test (the existing one uses 4 different Learners). It passes on SQLite today and guards the pg path.
- **Dialect-specific raw SQL in tests:**
  - `src/db/migrate.test.ts`: `PRAGMA journal_mode` and `sqlite_master`. Assert WAL on SQLite only, and list tables via `information_schema` on pg.
  - `src/server/publish.test.ts:49,65` read the snapshot as raw text. Compare the parsed value instead.
- **e2e.** The `sql()` helper in `e2e/learner-helper.ts` uses libsql, `?` params, busy_timeout and ms-integer timestamps. It needs a pg branch (the `pg` client, `$n` params, `to_timestamp(ms/1000.0)` for the times).
  - `e2e/verification.spec.ts:18`: portable except for the timestamps.
  - `e2e/statistics.spec.ts:34`: `json_object`/`json_extract` becomes `jsonb_build_object(snapshot->'questions'->0->>'id', …)`.
  - Two seeds, one variant per dialect.
- **CI**: a matrix on dialect for `npm test` and `npm run test:e2e`. The pg leg adds `-f compose.postgres.yml`.

## Suggested tickets

1. An ADR for dual-dialect support that amends 0005/0006: SQLite stays the default, and Postgres is for operators who want it.
2. Portable-code prep, still on SQLite and with no behaviour change:
   - shared `Db` type,
   - `rowsAffected` → `.returning().length`,
   - snapshot deep-equal,
   - migrations moved to `drizzle/sqlite/`,
   - the same-Learner `saveAnswer` race test.
3. The pg schema twin, the drift test, `drizzle/pg` baseline, the runtime dialect choice in `src/db` (`index.ts`, `schema.ts`, `migrate.ts`), and the Better Auth provider.
4. The pg transaction wrapper (serializable + retry) in `open.ts`, and Vitest on a real Postgres. The race tests go green on both.
5. `compose.postgres.yml`, the operator CLI, the e2e `sql()` helper and seeds, the CI matrix, and the README.
