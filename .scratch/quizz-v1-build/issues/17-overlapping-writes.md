# Overlapping writes fail with SQLITE_BUSY

Status: ready-for-agent
Blocked by:

## What to build

Queue write transactions in the app process, so two that overlap run one after the other instead of the second failing.

## Why

libsql starts every transaction with `BEGIN IMMEDIATE`, and its busy timeout defaults to 0. When a second transaction begins while another holds SQLite's write lock, it fails at once with `SQLITE_BUSY`, and the request returns a 500. For example, when two Learners save answers at the same moment, one of them sees "Not saved".

A busy timeout (`createClient({ timeout })`) doesn't fix it. libsql's native calls are synchronous, so the waiting `BEGIN` blocks the event loop, and the transaction holding the lock can never commit. Tried in ticket 11: it waited the full timeout, then failed.

`startAttempt` has a narrow workaround: it retries on `SQLITE_BUSY` (see the `ponytail:` comment in `src/server/attempts.ts`). Remove it once this ticket lands.

## Acceptance criteria

- [ ] In `src/db`, every `db.transaction` in the process waits its turn in a queue, including Better Auth's through the Drizzle adapter.
- [ ] No transaction calls `db.transaction` from inside another; that would deadlock the queue. Check the code and Better Auth's adapter.
- [ ] Remove the `startAttempt` retry. Its race test (4 simultaneous Starts resume one Attempt) still passes.
- [ ] Vitest: overlapping `saveAnswer` calls from different Learners all succeed. Tests build the database the same way the app does, so they go through the queue.
- [ ] ADR 0006 still holds: no SQLite-only SQL. Note the queue in the ADR as a consequence of SQLite having one writer; it goes away with Postgres.

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
