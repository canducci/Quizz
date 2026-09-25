# Certificate issue and PDF

Status: ready-for-agent
Blocked by: 08

## What to build

A pass issues the Certificate, emailed as a PDF (Variant C).

## Acceptance criteria

- [ ] On a pass, in the submit transaction: `certificate` row with 16-char Crockford base32 `public_id`, holder name, score, expiry from settings; counter `certificates_issued`. On a fail the name is discarded.
- [ ] PDF with @react-pdf/renderer + `qrcode`, bundled Source Serif 4 and Source Sans 3 (static TTF, OFL), branding from the Version snapshot, all text in the Assessment Language, QR to `/c/<id>`.
- [ ] Long names shrink to fit and wrap; nothing clipped.
- [ ] Email with the PDF attached (always sent, even past the daily cap).
- [ ] Acceptance by eye: side by side with the showcase Certificate tab, including its long-name samples, EN and PT.
- [ ] Vitest: ID generation format and alphabet; name size calculation.
- [ ] Playwright: pass an Attempt, find the email with a PDF attachment in Mailpit.

## Design reference

Showcase: https://canducci.github.io/Quizz/#certificate (source prototype branches listed in `spec.md`).

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
