# Assessment editor: Questions

Status: resolved
Blocked by: 02

## What to build

A Creator creates a Draft Assessment and writes its Question Pool in the editor (Variant B).

## Acceptance criteria

- [x] Dashboard lists the Creator's Assessments; "New Assessment" creates a Draft with a title.
- [x] Editor top bar (title, Assessment Status, version, tabs Questions / Rules / Access & language / Publish) as in the design; this ticket builds the Questions tab.
- [x] Questions tab: pool list (incomplete Questions flagged), editor for the selected Question (type single / multi / true-false, Markdown text, up to 8 options with correct ones marked, keep order), delete.
- [x] Markdown via react-markdown + remark-gfm + rehype-sanitize then rehype-highlight; one shared component for preview and Attempt. Images only from `/files/…`; image upload from the editor (PNG/JPEG).
- [x] Live Learner preview pane in the Attempt style.
- [x] Vitest: sanitiser strips script, raw HTML and external image URLs; Question completeness rules.
- [x] Playwright: create a Draft, add one Question of each type, see it in the preview.

## Design reference

Showcase: https://canducci.github.io/Quizz/#editor (source prototype branches listed in `spec.md`).

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
