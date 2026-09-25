# Quizz v1 spec

Status: needs-triage

Vocabulary follows `CONTEXT.md`. Decisions recorded in `docs/adr/`.

## Scope

- Assessment and certification only; no course hosting (ADR 0001).
- Multi-tenant: any Creator can sign up. Certificates carry the Creator's name and brand.
- Free for now. Pricing will be decided later; nothing in v1 meters or charges.
- Open source under AGPL-3.0 (ADR 0003). Tech stack: TypeScript/Next.js as a portable Docker image, Postgres, and email over SMTP (ADR 0004).

## Creators

- One owner login per Creator; no team members or roles in v1.
- Sign in with a magic link or Google.
- Certificate branding: one fixed layout. The Creator sets the logo, accent colour, signer name and signature image.
- Creators never see an individual Learner. They see Assessment Statistics only, from the first Attempt, with no minimum group size (ADR 0002).
- Assessment Statistics: Attempt count, pass rate, score distribution, correct-answer rate per Question, median time taken, Certificates issued, revoked and expired; date filter. No per-Attempt rows and no export of individuals.
- Deleting a Creator account keeps their Certificates valid. A Creator Ban revokes every Certificate that Creator issued.

## Assessments

- Assessment Status: Draft → Published ⇄ Closed. An Assessment with any Certificates can't be deleted.
- Publishing creates an immutable Assessment Version. Editing a published Assessment creates a new version, and each Certificate stays tied to the version it was earned on.
- Settings: Assessment Language (English or pt-BR), Access Mode (Public or Invite-only; default Public), Passing Score, time limit, number of Questions drawn (N), Retake Policy (max Attempts and cooldown), optional Expiry (off by default).
- Invite-only: the Creator supplies emails. We store only their keyed hashes and match them when a Learner verifies.
- Questions: single-answer multiple choice, multi-select multiple choice, and true/false. All auto-graded.
- Question content is Markdown (code blocks and images), in both the question and its answer options.
- Questions are written in the editor or imported from CSV. AI generation is out of v1.
- The Question Pool must hold at least N Questions.

## Attempts

- Before every Attempt, the Learner verifies their email with a one-time code.
- Each Attempt draws a random N Questions from the pool. Answer options are shuffled unless the Question is marked "keep order".
- The server holds the clock: each Attempt stores its deadline, and an overdue Attempt is finalized the next time anything reads it. A daily cleanup job finalizes abandoned ones.
- Answers save as they go. A Learner who disconnects can resume the same Attempt, and the clock keeps running. When time runs out, the Attempt is submitted automatically with the answers given so far.
- The Retake Policy is enforced on the keyed email hash.
- Afterwards the Learner sees only their score and pass/fail. There's no per-question review.
- Cheating deterrents: time limit, random draw, retake limit and cooldown. No proctoring.

## Certificates

- On passing, the Learner confirms their full name ("this is how it will appear"). The Certificate is then issued and can't be changed. Corrections are made by revoking and reissuing, which gives a new URL.
- The Certificate attests to the Learner's name, the Assessment (and version), the score, the date, and the Creator.
- Delivered by email as a PDF in the Assessment Language, with a QR code linking to the Verification Page.
- Verification Page: public, at an unguessable unique URL. It shows validity, revoked (with date) or expired. It always shows "Issued by <Creator> via Quizz", when the Creator joined, and a report-abuse link. Labels follow the viewer's interface language; content stays in the Assessment Language.
- Revocation: the Creator gives a reason and finds the Certificate by its ID or URL, or by the Learner's email (hashed for the lookup).

## Learner privacy (ADR 0002)

- Emails are never stored in plain text. We keep only a keyed hash (HMAC with a server secret). The plain email is used only to send the one-time code and the Certificate.
- The name is collected only on passing, and stored only on the Certificate.
- My Certificates: the Learner verifies their email with a one-time code, then sees all their Certificates across Creators and can request Learner Erasure.
- Learner Erasure deletes all of that Learner's data, including Certificates (their Verification Pages then show not found), and resets their retake counts.
- Confirm the Learner Erasure and data-transfer approach with someone who knows LGPD before launch.

## Interface

- The whole app can be switched between English and pt-BR. Each Assessment's content is in its single Assessment Language.

## Out of v1

Course hosting, pricing and billing, Creator teams and roles, a certificate designer, Question categories and spread-by-category draws, manually or AI-graded questions, AI question generation, per-question review for Learners, proctoring, webhooks and integrations (anything that sends Learner identity to a Creator would need the Learner's opt-in), verified-domain Creators, Open Badges 3.0, a minimum group size for statistics.
