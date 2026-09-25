# CAPTCHA on public forms

Status: needs-triage
Blocked by:

## What to build

Research a CAPTCHA that fits the product, record the choice in an ADR, then put it on every public form that sends email.

## Why

Anyone can submit these forms without an account, and each submit sends an email from our domain. A bot can use them to spam arbitrary addresses and burn the email quota and sender reputation. Better Auth's rate limit (5 magic links per IP a minute) only slows one IP; it doesn't stop a distributed bot.

Public forms today:

- Creator sign-in, magic link: `src/app/page.tsx` → `src/components/sign-in-form.tsx`
- Learner sign-in to My Certificates: `src/app/me/page.tsx` → `src/components/sign-in-form.tsx`
- Learner entry, one-time code: `src/app/a/[id]/page.tsx` → `src/components/entry-form.tsx`

The Verification Page (`/c/[id]`) has no form, only a mailto link, so it's out of scope.

## Research (first half)

Pick one and write it up as the next free ADR. Weigh against the ADRs already in place:

- Self-hosted first (ADR 0005): works with no third-party account, or degrades cleanly when none is configured.
- Learner privacy (ADR 0002): no tracking cookies or cross-site profiling of Learners.
- AGPL (ADR 0003): the client widget's license must be compatible.
- Low budget: free tier or free forever.
- Accessibility: no image puzzles; usable by keyboard and screen reader.
- pt-BR and English.

Candidates to start from: ALTCHA (self-hosted proof-of-work, no third party), Cloudflare Turnstile, hCaptcha, Friendly Captcha. Rule out reCAPTCHA unless the others fail, for privacy reasons.

## Acceptance criteria

- [ ] The ADR records the choice, the rejected options and why.
- [ ] The server verifies the CAPTCHA token before sending any email, on all three forms. A missing or bad token gets a translated error, and no email goes out.
- [ ] Verification happens server-side at the trust boundary (the server action or a Better Auth hook), not only in the client.
- [ ] Configured through env (`src/server/env.ts` validation, `.env.example`, README). With no config, self-hosted installs still work: the ADR says whether that means CAPTCHA off or the self-hosted provider on by default.
- [ ] Every new string in English and pt-BR. Learner-facing forms use the Assessment Language.
- [ ] Vitest: token verification accepts a good token and rejects missing or bad ones.
- [ ] Playwright: the existing sign-in and entry flows still pass (test keys or a test-mode bypass that is impossible to enable in production), and one test shows a submit without a valid token sends no email.

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
