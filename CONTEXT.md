# Quizz

A multi-tenant service where Creators test Learners' knowledge of a topic and issue verifiable Certificates to those who pass. Course content lives elsewhere; this context covers only assessment and certification.

## Actors

**Operator**:
The person who runs a Quizz instance. Receives abuse reports from Verification Pages and can apply a Creator Ban.
_Avoid_: Admin, host, owner

**Creator**:
A person or organization (the tenant) that builds Assessments and issues Certificates under its own name and brand.
_Avoid_: User, instructor, author, tenant (in user-facing language)

**Learner**:
A person who takes an Assessment, identified by email address; has no account. Creators never see a Learner's identity; it appears only on that Learner's Certificate.
_Avoid_: User, student, candidate, taker

**Creator Ban**:
Removal of a Creator for abuse such as impersonation; revokes every Certificate the Creator issued. Distinct from a Creator deleting their account, which leaves their Certificates valid.

**Learner Erasure**:
A Learner's self-service deletion of all their data, including their Certificates, whose Verification Pages then show as not found. Distinct from Revocation. Erasure also resets the Learner's Retake Policy counts.
_Avoid_: Revocation, account deletion

## Assessment

**Assessment**:
A Creator-defined test on a topic, with a Question Pool, a Passing Score, a time limit and a retake policy.
_Avoid_: Quiz, exam, test, course

**Assessment Status**:
Where an Assessment is in its life: Draft (being edited, no Attempts), Published (open for Attempts) or Closed (no new Attempts; its Certificates stay valid; can be reopened). An Assessment with any Certificates can never be deleted, only Closed.
_Avoid_: Archived, inactive

**Assessment Version**:
An immutable snapshot of an Assessment's Question Pool and settings, created on publish; editing a published Assessment creates a new version. Invisible to Learners.
_Avoid_: Revision, draft

**Access Mode**:
Whether an Assessment is open to anyone with its link (Public) or only to emails the Creator has invited (Invite-only).
_Avoid_: Visibility, privacy

**Assessment Language**:
The single language (English or pt-BR) a Creator sets for an Assessment's content, independent of the language the app interface is shown in.

**Question**:
A single auto-gradable item: multiple choice (single or multi-select) or true/false.
_Avoid_: Item, problem

**Question Pool**:
The set of Questions belonging to an Assessment, from which each Attempt draws a random subset.
_Avoid_: Question bank

**Attempt**:
One timed sitting of an Assessment by a Learner. It ends either Submitted (scored, passed or failed) or Timed out (not submitted by its deadline; no score, can't pass).
_Avoid_: Submission, session, try

**Passing Score**:
The minimum score an Attempt needs for the Learner to earn a Certificate. After an Attempt the Learner sees only the score and pass/fail, never which Questions were wrong.
_Avoid_: Cutoff, threshold

**Retake Policy**:
The maximum number of Attempts a Learner may make on an Assessment and the cooldown between them. The count starts again when the Learner's Certificate for that Assessment reaches Expiry.

**Assessment Statistics**:
Aggregate figures for an Assessment (Attempts, pass rate, score distribution, correct-answer rate per Question, time taken, Certificates issued, revoked and expired). Running counters that Learner Erasure never lowers. The only view a Creator has of Learner activity.
_Avoid_: Results, report, analytics

## Certification

**Certificate**:
An immutable record that a Learner passed a specific Assessment Version, with the name the Learner entered at submit, score and date, issued under the Creator's brand. Corrections are made by revoking and reissuing.
_Avoid_: Badge, diploma, credential

**Verification Page**:
The public page at a Certificate's unique URL that lets any third party confirm the Certificate is genuine; the Certificate PDF links to it by QR code. Always shows "Issued by <Creator> via Quizz", when the Creator joined, and a way to report abuse. Labels follow the viewer's interface language; Certificate content stays in the Assessment Language.
_Avoid_: Validation page, proof link

**My Certificates**:
The page where a Learner proves their email with a one-time code and sees every Certificate issued to that email across all Creators; also where they request Learner Erasure.
_Avoid_: Wallet, profile, dashboard

**Revocation**:
A Creator's withdrawal of a Certificate, with a reason that stays private to the Creator; the Verification Page stays up and shows only that it was revoked, and when. Also used when a Learner corrects their name (reason "Name correction"), which isn't counted as revoked in Assessment Statistics; such a Certificate shows as Replaced.
_Avoid_: Deletion, cancellation

**Expiry**:
An optional per-Assessment validity period after which its Certificates show as expired; off by default.
