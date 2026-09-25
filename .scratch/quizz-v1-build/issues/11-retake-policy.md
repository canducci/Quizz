# Retake Policy

Status: ready-for-agent
Blocked by: 09

## What to build

Enforce retakes on the email hash.

## Acceptance criteria

- [ ] Max Attempts and cooldown per spec; cooldown from submit, or from the deadline for Timed out.
- [ ] A Learner holding a Valid Certificate can't start; they see a link to it.
- [ ] The count covers only Attempts started after the Learner's last Certificate for the Assessment expired; Revocation doesn't reset it.
- [ ] Can't-start messages show the next allowed date and time.
- [ ] Vitest: every rule above with a fake clock.

## Design reference

Showcase: https://canducci.github.io/Quizz/#attempt (source prototype branches listed in `spec.md`).

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
