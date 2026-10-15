# ALTCHA proof of work on the public forms that send email

Every public form that sends email (Creator sign-in, the Learner's code on an Assessment link, and the My Certificates code) asks the browser to solve an ALTCHA proof-of-work challenge first, and the server checks the solution before any email goes out. The challenge is issued and verified by our own server with `altcha-lib` (MIT): there is no third-party account, script or cookie, and nothing for the person to click or read, so it works for keyboard and screen-reader users and needs no translated widget. It is on by default with no configuration: the signing key is derived from `BETTER_AUTH_SECRET`, and `CAPTCHA_DIFFICULTY` only tunes how much work a solve takes.

We weighed it against the ADRs already in place:

- **Cloudflare Turnstile** is free and mostly invisible, but needs a Cloudflare account and site key, so a fresh self-hosted install either breaks or runs unprotected (ADR 0005). Its script loads from Cloudflare and sends browser signals there, which is the cross-site profiling of Learners that ADR 0002 rules out.
- **hCaptcha** needs an account and keys, sets cookies on its own domain, and falls back to image puzzles, which fail the accessibility requirement.
- **Friendly Captcha** is proof of work too, but verification goes through its hosted API with an account key, and its free plan is for non-commercial use only.
- **reCAPTCHA** was ruled out for privacy before we started.

## Consequences

- Proof of work raises the cost of each email for a bot; it doesn't tell a bot from a person. A determined attacker with enough CPU still gets through, slowly. The per-email, per-IP and daily limits stay in place behind it.
- A solution is accepted once. Spent challenges are remembered in process memory, which matches ADR 0005's single instance. Serverless or more than one instance would need a shared store.
- Each submit fetches and solves a fresh challenge, which expires after 10 minutes, so a form left open for a long time still works.
- The forms already need JavaScript, so a browser without it was never able to submit them.
- Tests use the real check: Playwright's browser solves the challenge like anyone else's, so there is no bypass to leave switched on in production.
