# Assessment settings: Rules and Access

Status: resolved
Blocked by: 03

## What to build

The Rules and Access & language tabs hold every Assessment setting.

## Acceptance criteria

- [x] Rules: Passing Score, time limit, number of Questions drawn (N), Retake Policy (max Attempts, cooldown), optional Expiry (off by default).
- [x] Access & language: Assessment Language (EN or pt-BR), Access Mode (Public default, Invite-only).
- [x] Invite-only: paste emails; stored only as `invite.email_hash` (HMAC per data model); shows the count, never the emails; adding or removing applies at once, no new Version.
- [x] Vitest: email normalisation and HMAC; invite add is idempotent.
- [x] Playwright: set rules, switch to Invite-only, paste emails, see the count.

## Design reference

Showcase: https://canducci.github.io/Quizz/#editor (source prototype branches listed in `spec.md`).

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
