# Slice v1 into build tickets

Type: grilling
Status: resolved
Blocked by: 02, 03, 04, 05, 06

## Question

How does v1 split into vertical-slice build tickets that each fit one AFK agent session? Start from a walking skeleton (compose up, Creator sign-in, Draft Assessment, publish, Attempt, Certificate, Verification Page), then layer on the rest of the spec. Each ticket gets acceptance criteria, `Blocked by` edges and the `ready-for-agent` status. Resolving this reaches the map's destination.

## Answer

Sixteen build tickets in `.scratch/quizz-v1-build/issues/` (`ready-for-agent`, with acceptance criteria, `Blocked by` edges and showcase links), from a walking skeleton to Creator deletion and the Operator ban. Rules every ticket follows: vertical slices with Playwright for the main path and Vitest for domain rules, EN and pt-BR strings in each ticket, each event bumps its own statistics counters.

Decided along the way:
- **Operator tools**: a Creator Ban is a CLI script (`docker compose exec app npm run operator -- ban <creator email>`); the Operator email and daily email cap are `.env` settings; no admin page.
- **Secrets and upgrades**: a committed `.env.example`; the app refuses to start without `EMAIL_HMAC_SECRET` or `BETTER_AUTH_SECRET` and prints how to generate them; migrations run at boot.
- **Backups**: out of scope for the localhost pilot.
- **Google sign-in**: configured in the skeleton, button shown only with a real `GOOGLE_CLIENT_ID`; no mock OAuth server. The owner is creating a real localhost OAuth client.
