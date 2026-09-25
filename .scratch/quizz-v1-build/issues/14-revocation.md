# Revocation by the Creator

Status: ready-for-agent
Blocked by: 09

## What to build

A Creator revokes a Certificate.

## Acceptance criteria

- [ ] Find by Certificate ID (with or without dashes), full URL, or the Learner's email (hashed for lookup).
- [ ] Reason required, stored privately; status revoked with date; counter `revoked`.
- [ ] Vitest: lookup by each form; reason never leaves Creator views.
- [ ] Playwright: revoke, then the Verification Page shows Revoked without the reason.

## Design reference

Showcase: https://canducci.github.io/Quizz/#editor (source prototype branches listed in `spec.md`).

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
