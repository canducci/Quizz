# Attempt flow

Status: ready-for-agent
Blocked by: 07

## What to build

A verified Learner takes an Attempt (Variant D).

## Acceptance criteria

- [ ] Start draws N random Questions and shuffles options unless keep order; stored on the Attempt with its deadline (server clock).
- [ ] Sidebar layout per design: clock marked "saved automatically", numbered squares, Previous / Next, Review & submit; mobile stacks the sidebar.
- [ ] Answers save as they go; reopening resumes the same Attempt with the clock still running.
- [ ] Review page lists answered/unanswered with change links, then the name field ("as it will appear on your Certificate if you pass") and Submit.
- [ ] Scoring; result shows score and pass/fail only. After the deadline, submit is refused and the Attempt is Timed out when next read.
- [ ] Counters: attempts, submitted, passed, score and time histograms, per-Question shown/correct.
- [ ] Vitest: draw, shuffle, scoring for each type, deadline checks, counters.
- [ ] Playwright: full Attempt pass and fail; resume after reload.

## Design reference

Showcase: https://canducci.github.io/Quizz/#attempt (source prototype branches listed in `spec.md`).

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
