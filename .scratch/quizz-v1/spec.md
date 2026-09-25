# Quizz v1 spec

Status: needs-triage

Vocabulary follows `CONTEXT.md`. Decisions recorded in `docs/adr/`.

## Prototypes

- Attempt and Certificate domain logic: branch `prototype/domain-logic`, file `prototypes/domain-logic.prototype.html`. It settled: no auto-submit (Timed out), name entered at submit, no retake while holding a Valid Certificate, statistics as running counters, name corrections not counted as revoked.
- Learner Attempt flow UI: branch `prototype/attempt-ui`, file `prototypes/attempt-flow.prototype.html`. Four variants compared; the chosen one is **Variant D** (open with `?variant=D`).
- Creator Assessment editor UI: branch `prototype/editor-ui`, file `prototypes/assessment-editor.prototype.html`. Three variants compared; the chosen one is **Variant B** (open with `?variant=B`).
- Assessment Statistics UI: branch `prototype/dashboard-ui`, file `prototypes/statistics-dashboard.prototype.html`. Three variants compared; the chosen one is **Variant A** (open with `?variant=A`).
- Verification Page UI: branch `prototype/verification-ui`, file `prototypes/verification-page.prototype.html`. Three variants compared; the chosen one is **Variant B** (open with `?variant=B`).
- Certificate PDF: branch `prototype/certificate-ui`, file `prototypes/certificate-pdf.prototype.html`. Three variants compared; the chosen one is **Variant C** (open with `?variant=C`).

## Data model

Schema sketch: [`data-model.md`](data-model.md).

## Scope

- Assessment and certification only; no course hosting (ADR 0001).
- Multi-tenant: any Creator can sign up. Certificates carry the Creator's name and brand.
- Free for now. Pricing will be decided later; nothing in v1 meters or charges.
- Open source under AGPL-3.0 (ADR 0003). Tech stack: TypeScript/Next.js as a portable Docker image, and email over SMTP (ADR 0004).
- Self-hosted first, including the pilot: SQLite for data, Silo (pgsty/silo, S3-compatible) for files (ADR 0005).
- Libraries: Drizzle on libsql (ADR 0006), next-intl, @react-pdf/renderer, react-markdown with rehype-sanitize, @aws-sdk/client-s3, Vitest and Playwright, npm, ESLint + Prettier, Node 26. CI on GitHub Actions runs manually only for now.

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
- Invite-only: the Creator pastes the emails. We store only their keyed hashes and match them when a Learner verifies. Quizz sends no invitations; the Creator shares the link.
- Questions: single-answer multiple choice, multi-select multiple choice, and true/false. All auto-graded.
- Question content is Markdown (code blocks and images), in both the question and its answer options. Images must be uploaded to Quizz; external image links are not allowed, because they would let a Creator see Learners' IP addresses (ADR 0002).
- Uploaded images (Question images, logo, signature) are PNG or JPEG only. Quizz serves every file itself; the file store is never public.
- Questions are written in the editor or imported from CSV. AI generation is out of v1.
- A Question has at most 8 answer options.
- CSV import: one row per Question; columns `type` (`single`|`multi`|`truefalse`), `question` (Markdown), `option_1`…`option_8`, `correct` (option numbers like `1;3`, or `true`/`false`), `keep_order` (`yes`/blank). Rows are added to the Question Pool; any invalid row rejects the whole file, with every error listed by row. The editor offers a template.
- The Question Pool must hold at least N Questions.

## Attempts

- Before every Attempt, the Learner verifies their email with a one-time code: 6 digits, valid 10 minutes, 5 wrong tries; at most 3 codes per email and 10 per IP per hour. A daily email cap per instance (default 300) stops new codes once reached ("try again tomorrow") but never Certificate emails.
- A Learner who can't start sees why: Draft is not found; Closed says so with the Creator's name; Invite-only checks the list only after the code ("This email isn't invited, ask <Creator>"); the Retake Policy shows when the next Attempt is allowed; a Valid Certificate is linked.
- Each Attempt draws a random N Questions from the pool. Answer options are shuffled unless the Question is marked "keep order".
- The server holds the clock: each Attempt stores its deadline. Answers save as they go. A Learner who disconnects can resume the same Attempt, and the clock keeps running.
- There is no auto-submit. An Attempt not submitted by its deadline is Timed out: no score, can't pass, and it counts against the Retake Policy, with the cooldown running from the deadline. An overdue Attempt becomes Timed out the next time anything reads it, and an hourly sweep inside the app times out abandoned ones (and counts each Timed out Attempt on its deadline's day).
- A Learner holding a Valid Certificate for the Assessment can't start another Attempt. Once it has expired or been revoked, they can (subject to the Retake Policy).
- When a Learner's Certificate expires, their Attempt count for that Assessment starts again from zero, so they can always renew. Revocation doesn't reset the count.
- The Retake Policy is enforced on the keyed email hash.
- Afterwards the Learner sees only their score and pass/fail. There's no per-question review.
- Cheating deterrents: time limit, random draw, retake limit and cooldown. No proctoring.

## Certificates

- The Learner enters their full name when submitting ("as it will appear on your Certificate if you pass"). A pass issues the Certificate in the same step; on a fail the name is thrown away. A Certificate can't be changed. The Learner can correct their name, which revokes the Certificate ("Name correction") and issues a new one at a new URL.
- The Certificate attests to the Learner's name, the Assessment (and version), the score, the date, and the Creator.
- Delivered by email as a PDF in the Assessment Language, with a QR code linking to the Verification Page.
- Verification Page: public, at an unguessable unique URL (`/c/<Certificate ID>`, 16 random characters shown as `XXXX-XXXX-XXXX-XXXX`). It shows validity, revoked (with date) or expired. It always shows "Issued by <Creator> via Quizz", when the Creator joined, and a report-abuse link: a `mailto:` to the Operator with the Certificate ID in the subject. Labels follow the viewer's interface language; content stays in the Assessment Language.
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
- Assessment editor layout (Variant B of the editor prototype): a top bar with the title, Assessment Status and version, tabs (Questions, Rules, Access & language, Publish) and the Publish button. The Questions tab has three panes: the Question Pool as a list (incomplete Questions flagged, correct-answer rate once published), the editor for the selected Question (type, Markdown text, answer options with correct ones marked, keep order), and a live Learner preview in the Attempt-flow style. Publish stays disabled while problems remain, and the Publish tab lists them. Editing a published Assessment shows that publishing creates a new Assessment Version and that existing Certificates stay on theirs.
- Assessment Statistics layout (Variant A of the dashboard prototype): a Statistics tab in the editor's top bar. One row of filters above everything: date range (last 7, 30 or 90 days, all time) and Assessment Version (all, or one version, which draws its Passing Score on the score chart). Then a row of number tiles (Attempts with Timed out count, pass rate, median time, Certificates issued with revoked and expired, Questions to review), then Attempts per day, the score distribution of submitted Attempts, and the correct-answer rate per Question with Questions under 50% highlighted. Every chart has hover tooltips and a table view. A range with no Attempts shows an empty state.
- Certificate PDF layout (Variant C of the certificate prototype): A4 landscape, everything centred. Creator logo and name at the top, a serif "Certificate" heading over a short accent-coloured rule, "This certifies that", the holder's name in serif over a hairline, then the sentence naming the Assessment and score. Along the bottom: issued date, Expiry (or "does not expire") and Certificate ID on the left, the QR code with its verification URL in the centre, signer's signature, name and title on the right. A soft accent-coloured arc sits behind the lower half. Long names shrink to fit and wrap; nothing is clipped. All text is in the Assessment Language.
- Verification Page layout (Variant B of the verification prototype): the Certificate drawn exactly as the PDF above. If it isn't valid, the drawing is greyed out under a large stamp (Revoked, Expired, Replaced). Below it, a status bar with icon and sentence, then the facts (holder, Assessment and version, score and Passing Score, issued, expires, Certificate ID) beside the issuer card ("Issued by <Creator> via Quizz", on Quizz since, report a problem) and Download PDF when valid. Not found shows only the status. An EN/PT switch changes the labels only.
- The Verification Page never shows a Revocation's reason, only its date; the reason stays private to the Creator. A Certificate replaced by a name correction says so with the date, and doesn't link to its replacement.

- The whole app can be switched between English and pt-BR. Each Assessment's content is in its single Assessment Language.

## Out of v1

Course hosting, pricing and billing, Creator teams and roles, a certificate designer, Question categories and spread-by-category draws, manually or AI-graded questions, AI question generation, per-question review for Learners, proctoring, webhooks and integrations (anything that sends Learner identity to a Creator would need the Learner's opt-in), verified-domain Creators, Open Badges 3.0, a minimum group size for statistics.
