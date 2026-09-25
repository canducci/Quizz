# Hourly sweep

Status: ready-for-agent
Blocked by: 09

## What to build

The in-process sweep per the "Daily cleanup trigger" decision.

## Acceptance criteria

- [ ] Started from `instrumentation.ts` (Node runtime), once at boot not awaited, then hourly with `setInterval(...).unref()`, guarded against dev double start.
- [ ] Times out overdue Attempts (counter `timed_out` on the deadline's day); records Certificates crossing Expiry once (`expiry_counted_at`, `expired` on the `expires_at` day).
- [ ] Deletes one-time codes older than a day, `email_day` older than a week, expired Better Auth sessions and verification tokens.
- [ ] Vitest: idempotence (running twice changes nothing), day attribution, catch-up after downtime.

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
