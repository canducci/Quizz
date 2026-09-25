# Verification Page

Status: ready-for-agent
Blocked by: 09

## What to build

The public page at `/c/<id>` (Variant B).

## Acceptance criteria

- [ ] Certificate drawn as on the PDF; stamp and greying for Revoked, Expired, Replaced; status bar; facts and issuer card ("Issued by <Creator> via Quizz", on Quizz since); Download PDF when valid; not found shows status only.
- [ ] Revocation reason never shown; Replaced shows its date, no link to the replacement.
- [ ] Report a problem: `mailto:` the `OPERATOR_EMAIL` with the Certificate ID in the subject.
- [ ] EN/PT switch changes labels only; ID accepted with or without dashes.
- [ ] Playwright: valid, revoked, expired, replaced (seeded) and not found.

## Design reference

Showcase: https://canducci.github.io/Quizz/#verification (source prototype branches listed in `spec.md`).

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
