# Publish, close and reopen

Status: ready-for-agent
Blocked by: 04

## What to build

Publishing freezes an Assessment Version; Creators can close and reopen.

## Acceptance criteria

- [ ] Publish tab lists problems (pool smaller than N, incomplete Questions, missing Passing Score or time limit, missing branding); Publish stays disabled while any remain.
- [ ] Publish creates an `assessment_version` with the JSON snapshot (settings, Questions with stable ids, frozen branding) and sets it current. Editing a published Assessment shows that publishing makes a new Version and existing Certificates stay on theirs.
- [ ] Published ⇄ Closed; an Assessment with Certificates can't be deleted, a Draft can.
- [ ] Vitest: snapshot is immutable and complete; problem list rules.
- [ ] Playwright: publish, edit, publish again → version 2; close and reopen.

## Design reference

Showcase: https://canducci.github.io/Quizz/#editor (source prototype branches listed in `spec.md`).

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
