# Quizz v1 spec

Status: needs-triage

Vocabulary follows `CONTEXT.md`. Decisions recorded in `docs/adr/`.

## Prototypes

- Attempt and Certificate domain logic: branch `prototype/domain-logic`, file `prototypes/domain-logic.prototype.html`. It settled: no auto-submit (Timed out), name entered at submit, no retake while holding a Valid Certificate, statistics as running counters, name corrections not counted as revoked.
- Learner Attempt flow UI: branch `prototype/attempt-ui`, file `prototypes/attempt-flow.prototype.html`. Four variants compared; the chosen one is **Variant D** (open with `?variant=D`).

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
- Assessment Statistics: Attempt count (including Timed out), pass rate, score distribution, correct-answer rate per Question, median time taken, Certificates issued, revoked and expired; date filter. No per-Attempt rows and no export of individuals.
- Assessment Statistics are running counters: Learner Erasure never lowers them. Revocations for a name correction aren't counted as revoked.
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
- The server holds the clock: each Attempt stores its deadline. Answers save as they go. A Learner who disconnects can resume the same Attempt, and the clock keeps running.
- There is no auto-submit. An Attempt not submitted by its deadline is Timed out: no score, can't pass, and it counts against the Retake Policy, with the cooldown running from the deadline. An overdue Attempt becomes Timed out the next time anything reads it, and a daily cleanup job times out abandoned ones.
- A Learner holding a Valid Certificate for the Assessment can't start another Attempt. Once it has expired or been revoked, they can (subject to the Retake Policy).
- When a Learner's Certificate expires, their Attempt count for that Assessment starts again from zero, so they can always renew. Revocation doesn't reset the count.
- The Retake Policy is enforced on the keyed email hash.
- Afterwards the Learner sees only their score and pass/fail. There's no per-question review.
- Cheating deterrents: time limit, random draw, retake limit and cooldown. No proctoring.

## Certificates

- The Learner enters their full name when submitting ("as it will appear on your Certificate if you pass"). A pass issues the Certificate in the same step; on a fail the name is thrown away. A Certificate can't be changed. The Learner can correct their name, which revokes the Certificate ("Name correction") and issues a new one at a new URL.
- The Certificate attests to the Learner's name, the Assessment (and version), the score, the date, and the Creator.
- Delivered by email as a PDF in the Assessment Language, with a QR code linking to the Verification Page.
- Verification Page: public, at an unguessable unique URL. It shows validity, revoked (with date) or expired. It always shows "Issued by <Creator> via Quizz", when the Creator joined, and a report-abuse link. Labels follow the viewer's interface language; content stays in the Assessment Language.
- Revocation: the Creator gives a reason and finds the Certificate by its ID or URL, or by the Learner's email (hashed for the lookup).

## Learner privacy (ADR 0002)

- Emails are never stored in plain text. We keep only a keyed hash (HMAC with a server secret). The plain email is used only to send the one-time code and the Certificate.
- The name is entered at submit and stored only on a pass, on the Certificate.
- My Certificates: the Learner verifies their email with a one-time code, then sees all their Certificates across Creators and can request Learner Erasure.
- Learner Erasure deletes all of that Learner's data, including Certificates (their Verification Pages then show not found), and resets their retake counts.
- Confirm the Learner Erasure and data-transfer approach with someone who knows LGPD before launch.

## Interface

- Attempt flow layout (Variant D of the UI prototype): a sidebar holds the Creator and Assessment name, a large clock marked "saved automatically", numbered question squares (answered ones filled, current one highlighted) for jumping between questions, and a "Review & submit" button. The main area shows one question at a time with Previous / Next. Before submitting, a review page lists every question as answered or not, with "change" links, followed by the name field and Submit.
- Mobile: the sidebar stacks above the question.

- The whole app can be switched between English and pt-BR. Each Assessment's content is in its single Assessment Language.

## Out of v1

Course hosting, pricing and billing, Creator teams and roles, a certificate designer, Question categories and spread-by-category draws, manually or AI-graded questions, AI question generation, per-question review for Learners, proctoring, webhooks and integrations (anything that sends Learner identity to a Creator would need the Learner's opt-in), verified-domain Creators, Open Badges 3.0, a minimum group size for statistics.
