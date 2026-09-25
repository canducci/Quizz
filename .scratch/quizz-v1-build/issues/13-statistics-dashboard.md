# Statistics dashboard

Status: ready-for-agent
Blocked by: 09

## What to build

The Statistics tab (Variant A), reading `stats_day` only.

## Acceptance criteria

- [ ] Filters: last 7 / 30 / 90 days / all time; Version (all or one, drawing its Passing Score on the score chart).
- [ ] Tiles: Attempts with Timed out, pass rate, median time (from the time histogram), Certificates issued with revoked and expired, Questions to review.
- [ ] Charts: Attempts per day, score distribution, correct-answer rate per Question (under 50% highlighted); each with tooltips and a table view; empty state.
- [ ] No per-Learner data anywhere (ADR 0002).
- [ ] Vitest: aggregation across days and versions, median from histogram.
- [ ] Playwright: seeded counters render tiles and table views.

## Design reference

Showcase: https://canducci.github.io/Quizz/#statistics (source prototype branches listed in `spec.md`).

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
