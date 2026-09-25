# My Certificates, name correction and Learner Erasure

Status: ready-for-agent
Blocked by: 09

## What to build

The Learner's own page.

## Acceptance criteria

- [ ] Verify email with a one-time code; list every Certificate for that email hash across Creators.
- [ ] Name correction: revokes with reason "Name correction" (status replaced, not counted as revoked) and issues a new Certificate at a new ID, emailed.
- [ ] Learner Erasure: confirm, then delete attempt, certificate, invite and one_time_code rows by email hash; statistics unchanged; old Verification Pages show not found.
- [ ] Vitest: erasure leaves `stats_day` untouched; replacement counters.
- [ ] Playwright: correct a name, see Replaced on the old page; erase, see not found.

## Design reference

Showcase: https://canducci.github.io/Quizz/#verification (source prototype branches listed in `spec.md`).

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
