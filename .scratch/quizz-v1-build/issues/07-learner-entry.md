# Learner entry and one-time codes

Status: resolved
Blocked by: 05

## What to build

A Learner opens an Assessment link and proves their email before starting.

## Acceptance criteria

- [x] Assessment link page shows Creator and Assessment name, rules summary, email field.
- [x] One-time code: 6 digits, 10 minutes, 5 wrong tries, stored hashed; 3 per email and 10 per IP per hour; instance daily email cap from `DAILY_EMAIL_CAP` (`email_day`), refusing codes with "try again tomorrow" but never Certificate emails.
- [x] Can't-start messages: Draft → not found; Closed → closed with Creator name; Invite-only checks the list only after the code; (Retake and Valid-Certificate messages come in "Retake Policy").
- [x] Vitest: code expiry, tries, rate limits, cap.
- [x] Playwright: request a code, read it in Mailpit, verify; wrong-code lockout; not-invited message.

## Design reference

Showcase: https://canducci.github.io/Quizz/#attempt (source prototype branches listed in `spec.md`).

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
