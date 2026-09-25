# Product gaps before build

Type: grilling
Status: resolved
Blocked by:

## Question

What does the spec still leave open for the product itself?

- Invite-only: does Quizz email the invitations, or does the Creator share the link themselves?
- Where does "report a problem" on the Verification Page go, and how is a report acted on?
- The CSV import format for Questions (columns, how correct answers and "keep order" are marked, Markdown in cells).
- Limits on one-time codes (per email, per IP) given the daily email cap.
- What a Learner sees when an Assessment is Closed, Draft, or the invite doesn't match.

## Answer

- **Invitations**: Quizz sends none. The Creator pastes the invite list (hashed at once, ADR 0002) and shares the link through their own channels. A Learner verifies their email with a one-time code, then is matched against the list.
- **Report a problem**: a `mailto:` link to the Operator's email (instance config) with the Certificate ID in the subject. No in-app report queue. How the Operator acts on it (e.g. a Creator Ban) is still open.
- **CSV import**: one row per Question; columns `type` (`single`|`multi`|`truefalse`), `question` (Markdown, quoted newlines allowed), `option_1`…`option_8`, `correct` (option numbers like `2` or `1;3`, or `true`/`false`), `keep_order` (`yes`/blank). Rows are appended to the Question Pool; any invalid row rejects the whole file, with every error listed by row number. The editor offers a template download. A Question has at most 8 options, in the editor too.
- **One-time codes**: 6 digits, valid 10 minutes, 5 wrong tries. At most 3 codes per email per hour and 10 per IP per hour. An instance-wide daily email cap (config, default 300) refuses new codes once reached ("try again tomorrow"), but Certificate emails still go out.
- **Learner can't start**: Draft → not found. Closed → "This Assessment is closed" with the Creator's name. Invite-only → the code comes first, then "This email isn't invited, ask <Creator>" (so nobody can probe the list). Retake Policy → the date and time of the next allowed Attempt. Holding a Valid Certificate → a link to it.
