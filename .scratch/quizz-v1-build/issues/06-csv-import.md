# CSV import

Status: resolved
Blocked by: 05

## What to build

Creators import Questions from CSV.

## Acceptance criteria

- [x] Columns per spec: `type`, `question`, `option_1`…`option_8`, `correct`, `keep_order`; quoted newlines allowed.
- [x] All-or-nothing: any invalid row rejects the file and lists every error with its row number; valid files append to the pool.
- [x] Template download from the editor.
- [x] Vitest: parser covers each type, bad `correct` values, too many options, Markdown with commas and newlines.
- [x] Playwright: import the template, see the Questions; import a bad file, see row errors and no change.

## Design reference

Showcase: https://canducci.github.io/Quizz/#editor (source prototype branches listed in `spec.md`).

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
