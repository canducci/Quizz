# Publish, close and reopen

Status: done
Blocked by: 04

## What to build

Publishing freezes an Assessment Version; Creators can close and reopen.

## Acceptance criteria

- [x] Publish tab lists problems (pool smaller than N, incomplete Questions, missing Passing Score or time limit, missing branding); Publish stays disabled while any remain.
- [x] Publish creates an `assessment_version` with the JSON snapshot (settings, Questions with stable ids, frozen branding) and sets it current. Editing a published Assessment shows that publishing makes a new Version and existing Certificates stay on theirs.
- [x] Published ⇄ Closed; an Assessment with Certificates can't be deleted, a Draft can.
- [x] Vitest: snapshot is immutable and complete; problem list rules.
- [x] Playwright: publish, edit, publish again → version 2; close and reopen.

## Notes

- Delete is Draft-only for now (no `certificate` table yet). Ticket 09 should allow deleting a Closed Assessment with no Certificates.
- Publishing a Closed Assessment makes a new Version but keeps it Closed.
- Missing branding = logo, signer name or signature image; the accent falls back to the default and is frozen as its effective value.

## Design reference

Showcase: https://canducci.github.io/Quizz/#editor (source prototype branches listed in `spec.md`).

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
