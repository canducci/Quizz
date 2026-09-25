# Map: Quizz v1 build plan

Label: wayfinder:map

## Destination

A build-ready plan for Quizz v1: every open question in `spec.md` answered, and v1 split into vertical-slice build tickets (`ready-for-agent`, with acceptance criteria, in dependency order) that AFK agents can pick up one per session. Reached when "Slice v1 into build tickets" is resolved.

## Notes

- Pilot with one or two known Creators; multi-tenant signup stays in the code as the spec says.
- Self-hosted first, including the pilot: one box, `docker compose`, SQLite and Silo (ADR 0005). No managed-platform features.
- Built by AFK agents, reviewed by the owner: each build ticket must fit one agent session and carry clear acceptance criteria.
- Vocabulary from `CONTEXT.md`; decisions in `docs/adr/`; product rules in `spec.md`. Grilling tickets call the "grilling" and "domain-modeling" skills. Chosen screen designs are live at https://canducci.github.io/Quizz/.
- Plan, don't build: nothing in this map writes app code.

## Decisions so far

<!-- one line per resolved ticket: [title](issues/NN-slug.md): gist -->

- [Product gaps before build](issues/04-product-gaps.md): no invite emails, abuse reports mailto the Operator, CSV columns fixed, one-time code limits and daily email cap, and what a Learner sees when they can't start.

## Not yet specified

- Certificate PDF fidelity: whether the chosen PDF library can draw Variant C exactly (fonts, the accent arc, shrinking long names) may need a prototype, depending on the stack choice.
- Backups and upgrades for self-hosters: how the SQLite file and Silo bucket get backed up and restored, and how schema migrations run when a self-hoster upgrades.
- Secrets: where the HMAC secret, SMTP and S3 credentials live and how a self-hoster generates them on first run.
- Operator tools: how the Operator applies a Creator Ban (a CLI, an admin page?) and sets the instance config (Operator email, daily email cap). Reports already arrive by email.

## Out of scope

- The LGPD review: required before a public launch, not for the pilot.
- Managed hosting (Vercel, Neon, Cloud Run): replaced by self-hosting first (ADR 0005).
- Writing self-hosting documentation and building the app: they follow this map.
