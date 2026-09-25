# Creator account deletion and Operator ban

Status: ready-for-agent
Blocked by: 14

## What to build

Creators can leave; the Operator can ban.

## Acceptance criteria

- [ ] Creator deletes their account: login removed (`auth_user_id` cleared), profile stays, Certificates stay valid and keep showing "Issued by <Creator>".
- [ ] `npm run operator -- ban <creator email>` (run via `docker compose exec app`): sets `banned_at`, revokes every Certificate of that Creator, blocks sign-in.
- [ ] Vitest: ban revokes all and is idempotent; deleted Creator's Certificates stay valid.
- [ ] Playwright: delete an account, its Certificate still verifies.

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
