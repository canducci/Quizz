# Tech stack options for Quizz (input for ADR 0003)

Researched 2026-09-25. Unless noted otherwise, every limit and price below was fetched from the cited official page on that date. Free tiers change often, so re-check them before deciding. Claims marked **unverified** could not be confirmed from a primary source.

## What the stack has to do (from CONTEXT.md and ADRs 0001 and 0002)

- Multi-tenant web app, bilingual UI (English and pt-BR). The Certificate and the Assessment content use the **Assessment Language**, while Verification Page labels follow the **viewer's** language. The i18n library therefore has to render in an explicit locale, not only in the request locale.
- **Creator** sign-in uses a magic link and Google OAuth.
- **Learners** have no accounts. A Learner proves an email with a one-time code, and only an HMAC of the email is stored (ADR 0002). No auth library covers this flow on any stack. It is a small custom module everywhere (generate code, hash email, store code hash plus expiry, send email), so the comparison below scores auth libraries only on the Creator side.
- Timed Attempts use a server-held clock and auto-submit on timeout.
- A Certificate PDF with a QR code, plus a public Verification Page.
- Transactional email: Learner one-time codes, Certificates, Creator magic links.

## Shared design decisions (apply to every stack)

### Attempt timer: lazy finalisation plus a sweeper

Don't use in-process timers (`setTimeout`, .NET `IHostedService` timers, Celery countdowns). Scale-to-zero hosts kill them, and all the free tiers below scale to zero or sleep. Instead:

1. When an Attempt starts, store `deadline = started_at + time_limit` (plus a small grace period) in Postgres.
2. Every answer or submit request checks `now() > deadline` on the server. Late answers are rejected.
3. Any read of an Attempt whose deadline has passed and which isn't submitted yet finalises it in the same transaction ("lazy auto-submit"). It is graded with whatever answers were saved. The Learner sees the result the next time they load the page, and the client-side countdown is cosmetic only.
4. A periodic **sweeper** finalises abandoned Attempts, so that Assessment Statistics and Retake Policy cooldowns are correct even if nobody ever reloads the page. Stats are aggregate, so the sweeper can run every few minutes or even daily without harming correctness, because lazy finalisation already covers every read path. Stats queries can also treat `deadline < now()` as finished.

With this design the choice of stack is **not** decided by queues or schedulers. It only needs some way to fire the sweeper. The options found:

| Scheduler | Free? | Minimum interval | Source |
|---|---|---|---|
| Vercel Cron (Hobby) | Yes | **Once per day**, ±59 min precision; more frequent expressions fail at deploy | https://vercel.com/docs/cron-jobs/usage-and-pricing |
| Vercel Cron (Pro) | With Pro | Once per minute | same |
| GitHub Actions `schedule` | Yes | Every 5 min. "can be delayed during periods of high loads". In a public repo, scheduled workflows are "automatically disabled when no repository activity has occurred in 60 days" | https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows |
| Google Cloud Scheduler | 3 jobs per billing account free, then $0.10/job/31 days | cron (per-minute) | https://cloud.google.com/scheduler/pricing |
| Azure Container Apps jobs (Schedule type) | Billed as consumption, so the free grant applies (**unverified** that jobs count against the same grant) | cron, examples down to `*/1 * * * *` | https://learn.microsoft.com/en-us/azure/container-apps/jobs |
| Supabase Cron (pg_cron) | Included (free-plan availability **unverified** on the docs page) | "every second to once a year" | https://supabase.com/docs/guides/cron |
| pg_cron on Neon | Available, but "Jobs only run when the compute is active", so it doesn't fire while scaled to zero | n/a | https://neon.com/docs/extensions/pg_cron |
| Render Cron Jobs | **Not on free plan** | n/a | https://render.com/docs/free |
| Self-hosted | `cron`, or a loop in a second container, calling `POST /internal/sweep` | any | n/a |

Recommendation for every stack: expose one idempotent `sweep` endpoint or command and trigger it from whatever scheduler the host has. Self-hosters can use plain cron.

### Database: managed Postgres

| Provider | Free tier | Gotchas | Paid | Source |
|---|---|---|---|---|
| **Neon** | 100 projects; 100 CU-hours/project/month; 0.5 GB storage/project; 5 GB egress/project; no card, no expiry | Scales to zero after 5 min idle, and **can't be disabled on Free**. Wake-up takes "a few hundred milliseconds" | Launch: $0.106/CU-hour, $0.35/GB-month | https://neon.com/pricing, https://neon.com/docs/introduction/scale-to-zero |
| **Supabase** | 500 MB DB; 5 GB egress; 50,000 MAU; **2 active projects** | Projects are "paused after 1 week of inactivity" | Pro $25/month (includes $10 compute credit) | https://supabase.com/pricing |
| **Render Postgres** | 1 GB | Free DBs "**expire 30 days after creation**" (14-day grace to upgrade) | $6/month (256 MB RAM), $19/month (1 GB RAM) | https://render.com/docs/free, https://render.com/pricing |

Neon is the default choice for the pilot. It's plain Postgres (no lock-in), it doesn't expire, and the cold start is sub-second. Render's free Postgres can't be used for anything that must persist. Supabase's weekly pause is survivable for a pilot with regular traffic, but it is a real risk during quiet periods.

### Transactional email

Every Attempt needs at least one email (the Learner one-time code), and every pass needs another (the Certificate). **Daily caps are the binding free-tier limit for Quizz.**

| Provider | Free | Cheapest paid | Source |
|---|---|---|---|
| **Resend** | 3,000/month, **100/day**, 3 domains | Pro $20/month for 50,000 | https://resend.com/pricing |
| **Brevo** | **300/day** (after account approval for sending) | not captured (page JS-rendered, **unverified**) | https://www.brevo.com/pricing/ |
| **Postmark** | 100/month (developer) | $15/month for 10,000 | https://postmarkapp.com/pricing |
| **Amazon SES** | New AWS customers get up to $200 of Free Tier credits | $0.10 per 1,000 (à la carte) | https://aws.amazon.com/ses/pricing/ |

Send through **SMTP or a thin `EmailSender` interface** so self-hosters can plug in any provider. Start the pilot on Brevo (300/day) or Resend (100/day, best developer experience). For scale, SES is by far the cheapest.

---

## Stack A: TypeScript / Next.js on Vercel + Neon + Resend

- **Language/framework:** TypeScript, Next.js (App Router). Next.js is deployable "as a Node.js server, Docker container, static export"; the Node server and Docker "support all Next.js features" (https://nextjs.org/docs/app/getting-started/deploying).
- **Hosting:** Vercel Hobby. Free: 1M function invocations/month, 4 h Active CPU, 100 GB Fast Data Transfer, 360 GB-hrs provisioned memory (https://vercel.com/docs/limits/fair-use-guidelines). Function limits: 2 GB / 1 vCPU, 300 s max duration, 250 MB bundle, 4.5 MB request/response body (https://vercel.com/docs/functions/limitations).
- **DB:** Neon (see above). Use its serverless or pooled driver from functions (driver choice not researched).
- **Email:** Resend (Auth.js and Better Auth both have first-class integrations: https://authjs.dev/getting-started/authentication/email).
- **PDF + QR:** `@react-pdf/renderer` (MIT, runs in Node; https://github.com/diegomura/react-pdf; behaviour inside a Vercel function not tested, **unverified**) plus the `qrcode` npm package (MIT; PNG/SVG/data-URL output; https://github.com/soldair/node-qrcode). Avoid headless Chromium: it works, but it is heavy against the 250 MB bundle and 4 h CPU budget.
- **Auth (Creators):** **Better Auth**. It has a magic-link plugin with a user-supplied `sendMagicLink` (https://www.better-auth.com/docs/plugins/magic-link), Google via `socialProviders.google` (https://www.better-auth.com/docs/authentication/google), and an email-OTP plugin (https://www.better-auth.com/docs/plugins/email-otp). Alternative: Auth.js, where email/magic link "requires a database" adapter (https://authjs.dev/getting-started/authentication/email). Don't use Lucia: it "was deprecated on March 2025" (https://github.com/lucia-auth/lucia).
- **Timer/sweeper:** lazy finalisation. Hobby cron is **daily only** (https://vercel.com/docs/cron-jobs/usage-and-pricing), which is fine for statistics hygiene; use GitHub Actions every 5 min if fresher statistics are needed.
- **i18n:** `next-intl`. It accepts an explicit locale in `getTranslations({locale: 'en'})` (https://next-intl.dev/docs/usage/configuration), which covers "render the Certificate in the Assessment Language".
- **Free-tier gotchas:**
  - **Vercel Hobby is "restricted to non-commercial personal use only"**. Commercial use covers "financial gain of anyone involved in any part of the production", including payment processing, ads, or being paid to build or host the site (https://vercel.com/docs/limits/fair-use-guidelines). *Our interpretation, not Vercel's:* a free, donation-funded OSS pilot looks acceptable (donations are explicitly allowed). Vercel says to contact support if you're unsure, so do that before launching. Any paid tier or paid hosting for Creators would force Pro at $20/month (https://vercel.com/pricing).
  - Hobby cron is daily with ±59 min jitter.
  - Neon scale-to-zero adds a sub-second first query.
  - Hobby functions run in a single region (`iad1` by default; https://vercel.com/docs/functions/limitations). Pick the Vercel and Neon regions together, for example both near the pt-BR audience.
- **Cost after free:** Vercel Pro $20/month plus usage; Neon Launch from about $0.106/CU-hour; Resend Pro $20/month.
- **Deploy effort:** lowest. Git push deploys, preview deployments, no Dockerfile needed for the hosted pilot.
- **Self-hostability:** good *if you avoid Vercel-only features* (Vercel Cron config, Blob, KV, Edge Config). Ship `output: "standalone"` Docker (official example: https://github.com/vercel/next.js/tree/canary/examples/with-docker) plus docker-compose with Postgres. Self-hosters then run the same image.

## Stack B: C# / ASP.NET Core container on Azure Container Apps (or Cloud Run) + Neon

- **Language/framework:** C#, ASP.NET Core (.NET 10), with Razor Pages or Blazor SSR. EF Core with Npgsql for Postgres.
- **Hosting:**
  - Azure Container Apps consumption plan: "The first 180,000 vCPU-seconds, 360,000 GiB-seconds, and 2 million requests per subscription per month are free" (https://azure.microsoft.com/en-us/pricing/details/container-apps/). Scales to zero by default (min replicas 0), and no usage charges while at zero (https://learn.microsoft.com/en-us/azure/container-apps/scale-app). Post-grant per-second prices weren't rendered on the page (**unverified**).
  - Equivalent on Google Cloud Run (request-based billing): 180,000 vCPU-seconds, 360,000 GiB-seconds, 2 million requests free per month; 1 GiB free egress within North America (https://cloud.google.com/run/pricing).
- **DB:** Neon. Azure Database for PostgreSQL is not free beyond trial offers (**unverified**).
- **Email:** any provider over SMTP (MailKit) or its HTTP API.
- **PDF + QR:**
  - **QuestPDF**, whose Community license is free for "individuals and businesses with annual gross revenue under USD 1,000,000, and for charitable organisations, academic institutions, and open-source projects". "Public-sector entities and publicly traded companies are not eligible, regardless of revenue" (https://www.questpdf.com/license/community.html). **OSS gotcha:** a large company, public university, or government agency self-hosting Quizz may need a paid QuestPDF license. Whether redistribution covers them is ambiguous, **unverified**. Alternative: PDFsharp/MigraDoc (MIT, **unverified**).
  - **QRCoder** is MIT, with PNG and SVG renderers that don't need System.Drawing (https://github.com/codebude/QRCoder).
- **Auth (Creators):** Google via `Google.Apis.Auth.AspNetCore3` / `AddGoogleOpenIdConnect` (https://learn.microsoft.com/en-us/aspnet/core/security/authentication/social/google-logins). **There is no built-in magic-link flow.** ASP.NET Core Identity provides token providers (`EmailTokenProvider<TUser>`, https://learn.microsoft.com/dotnet/api/microsoft.aspnetcore.identity.emailtokenprovider-1), so a magic link is a custom endpoint of roughly 100 lines: generate a token, email it, verify it, then `SignInAsync`. Alternatively, skip Identity and use plain cookie auth (https://learn.microsoft.com/aspnet/core/security/authentication/cookie).
- **Timer/sweeper:** lazy finalisation. The sweeper runs as a Container Apps **Schedule job** (cron; https://learn.microsoft.com/en-us/azure/container-apps/jobs) or through Cloud Scheduler (3 free jobs; https://cloud.google.com/scheduler/pricing). On a self-hosted always-on box, a `BackgroundService` loop is fine.
- **i18n:** built-in `IStringLocalizer` with `.resx` files. `ResourceManager` looks up strings by `CurrentUICulture`, so a per-render locale works by setting `CultureInfo.CurrentUICulture` around the Certificate render (https://learn.microsoft.com/en-us/aspnet/core/fundamentals/localization).
- **Free-tier gotchas:**
  - Cold start after scale-to-zero. .NET startup is slower than Node unless you use ReadyToRun/AOT (latency figures **unverified**).
  - The Azure docs require configuring ASP.NET Core data protection for .NET apps on Container Apps (https://learn.microsoft.com/en-us/azure/container-apps/scale-app). Otherwise auth cookies break across replicas and restarts.
  - Probably needs an Azure subscription or GCP billing account with a card (**unverified**).
  - Container registry: use GHCR to avoid ACR/Artifact Registry costs (**unverified** pricing).
- **Cost after free:** pay-per-second compute past the grant, which for a small app is likely a few dollars a month (**unverified**, rates not captured).
- **Deploy effort:** medium. Dockerfile, registry, and a GitHub Actions workflow to deploy; more cloud console setup than Vercel.
- **Self-hostability:** excellent. A single container plus Postgres in docker-compose, the same artifact as production. The QuestPDF license is the only caveat.

## Stack C: Python / Django on Render + Neon

- **Language/framework:** Python, Django (batteries included: ORM, migrations, admin, forms, i18n).
- **Hosting:** Render free web service. 750 free instance hours/month per workspace. It spins down after **15 min** without traffic, and spin-up "takes about one minute" (https://render.com/docs/free). Hobby workspace: $0/month plus compute, 5 GB bandwidth included (https://render.com/pricing).
- **DB:** **Neon, not Render Postgres**, because Render's free DB expires after 30 days (https://render.com/docs/free).
- **Email:** any provider via Django's SMTP backend.
- **PDF + QR:** WeasyPrint (HTML/CSS to PDF, so Certificate templates are ordinary Django templates). It needs system packages `libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0` (https://doc.courtbouillon.org/weasyprint/stable/first_steps.html), so use a Docker deploy. QR via `segno` (BSD-3-Clause, pure Python, no dependencies; https://github.com/heuer/segno).
- **Auth (Creators):** django-allauth handles Google. Its passwordless option is "Login by email" with a **one-time code** (`ACCOUNT_LOGIN_BY_CODE_ENABLED`, "often referred to as Magic Code Login"; https://docs.allauth.org/en/latest/account/configuration.html). That is a code rather than a clickable link: the same UX family, and arguably better on mobile. A true link needs a small custom view or a third-party package (not researched).
- **Timer/sweeper:** lazy finalisation. **Render cron jobs aren't free** (https://render.com/docs/free), so trigger a management command through a protected endpoint from GitHub Actions (5 min).
- **i18n:** built-in gettext. `translation.override(language)` renders in an explicit locale (https://docs.djangoproject.com/en/5.2/topics/i18n/translation/).
- **Free-tier gotchas:**
  - **The one-minute cold start after 15 min idle** is the worst of the four stacks. The first Learner of the day, and anyone opening a Verification Page from a QR code, waits about a minute.
  - Keep-alive pings would burn the 750 hours: roughly 744 h in a 31-day month for one always-on service, which is just inside the limit but leaves nothing for a second service. That figure is our arithmetic.
- **Cost after free:** Render Starter $7/month (512 MB) (https://render.com/pricing); Neon as above.
- **Deploy effort:** low to medium. Git-connected Render deploy from a Dockerfile.
- **Self-hostability:** excellent. One container plus Postgres; Django is very familiar to OSS contributors.

## Stack D: Supabase-centric (Supabase Postgres + Auth + Cron) with Next.js on Vercel

- **Language/framework:** TypeScript/Next.js as in Stack A, but auth, the database and cron come from Supabase.
- **Hosting:** Vercel Hobby (same terms as Stack A) plus Supabase Free.
- **DB:** Supabase Postgres, 500 MB, **paused after 1 week of inactivity**, 2 active projects max (https://supabase.com/pricing).
- **Email:** Supabase Auth's built-in SMTP "is not meant for production use". It only sends to pre-authorised addresses and is limited to **2 messages per hour**. With custom SMTP, the default rate limit is 30/hour until you raise it (https://supabase.com/docs/guides/auth/auth-smtp). You still need Resend or Brevo.
- **PDF + QR:** same as Stack A.
- **Auth (Creators):** Supabase Auth provides magic links and a 6-digit email OTP out of the box (https://supabase.com/docs/guides/auth/auth-magic-link), plus Google (https://supabase.com/docs/guides/auth/social-login/auth-google). This is the least auth code of any option. The Learner one-time code should still be custom, because Supabase Auth would create a user row keyed by the **plain email**, which conflicts with ADR 0002.
- **Timer/sweeper:** Supabase Cron (pg_cron) can run the sweep as SQL inside the database, at intervals down to seconds (https://supabase.com/docs/guides/cron). This is the best native scheduler of the four.
- **i18n:** as Stack A.
- **Free-tier gotchas:** the weekly pause; the email rate limits above; 2-project cap (production plus staging uses both).
- **Cost after free:** Supabase Pro $25/month (https://supabase.com/pricing) plus Vercel Pro $20 if commercial.
- **Deploy effort:** low for the hosted pilot.
- **Self-hostability:** **weakest.** Self-hosted Supabase is a multi-service docker-compose (Studio, Auth, PostgREST, Realtime, Storage, Edge Runtime, postgres-meta, Supavisor and others), with a minimum of 4 GB RAM and 2 cores, 8 GB recommended (https://supabase.com/docs/guides/self-hosting/docker). Code written against Supabase Auth, RLS and PostgREST is also hard to move back to plain Postgres. This is the deepest lock-in of the four.

---

## Comparison

| | A: Next.js + Vercel + Neon | B: ASP.NET Core + ACA/Cloud Run + Neon | C: Django + Render + Neon | D: Supabase + Next.js/Vercel |
|---|---|---|---|---|
| Contributor familiarity | Very high (TS/React) | High (C#), smaller OSS web pool (judgement) | Very high (Python) | High (TS), but Supabase-specific |
| Creator auth | Better Auth: magic link + Google, plugins | Google built in; **magic link custom** | allauth: Google + **email code** (not link) | Supabase Auth: link + OTP + Google |
| Learner OTP | Custom (all stacks) | Custom | Custom | Custom (must not use Supabase Auth, ADR 0002) |
| PDF + QR | react-pdf (MIT) + qrcode (MIT) | QuestPDF (**revenue/public-sector license limits**) + QRCoder (MIT) | WeasyPrint (needs Pango) + segno (BSD-3) | as A |
| Free sweeper | Vercel Cron daily, or GH Actions 5 min | ACA Schedule job / Cloud Scheduler (3 free) | GH Actions 5 min (Render cron not free) | pg_cron, down to seconds |
| i18n with explicit locale | next-intl `getTranslations({locale})` | resx + CurrentUICulture | gettext `override()` | as A |
| Cold start (free) | Function cold start plus Neon wake (<1 s) | Container scale-from-zero plus Neon wake | **~1 min after 15 min idle** | Function cold start; DB **paused after 7 days idle** |
| Hosting free limits | 1M invocations, 4 h CPU, 100 GB transfer | 180k vCPU-s, 360k GiB-s, 2M requests | 750 h/month, 5 GB bandwidth | Vercel as A; 500 MB DB, 5 GB egress |
| Terms gotcha | **Hobby non-commercial only** | Card/billing account required | none found | Vercel Hobby non-commercial; Supabase SMTP 2/h |
| First paid step | Vercel Pro $20/month | Pay-per-use, likely a few $ (**unverified**) | Render Starter $7/month | Supabase Pro $25/month (+ Vercel Pro $20) |
| Deploy effort | Lowest | Medium | Low to medium | Low |
| Self-hosting (Docker + Postgres) | Good (standalone image; avoid Vercel-only APIs) | Excellent | Excellent | Poor (8 GB-class multi-service stack) |

Email is the same for every stack: Resend 100/day, Brevo 300/day, Postmark 100/month free; SES $0.10 per 1,000.

## Recommendation

**Stack A: TypeScript + Next.js + Better Auth + Neon + Resend (or Brevo), deployed to Vercel Hobby for the pilot and shipped as a standalone Docker image for self-hosters.**

Reasoning:
1. **Largest contributor pool and lowest deploy effort.** Push to deploy, preview environments, and nothing to operate.
2. **Every requirement has a mainstream, permissively licensed piece.** Better Auth covers magic link plus Google. `@react-pdf/renderer` is MIT and needs no system libraries. `next-intl` supports an explicit locale for Certificates. There is no QuestPDF-style license trap.
3. **The timer doesn't need a real scheduler** thanks to lazy finalisation. Vercel's daily cron, or GitHub Actions every 5 min, is enough for the sweeper.
4. **No lock-in if you're disciplined.** Plain Postgres (Neon), SMTP/HTTP email behind an interface, and no Vercel Cron, Blob or KV in application code. The sweeper is an HTTP endpoint any cron can call. Self-hosters run `docker compose up` with the app and Postgres.
5. **Confirm the Hobby terms.** The pilot host depends on Vercel's non-commercial clause, so confirm with Vercel support that a free OSS service qualifies.
6. **Exit ramp.** If the Hobby non-commercial clause ever bites, the same Docker image moves to Cloud Run (free tier above) or Render with no code changes, instead of paying Vercel Pro's $20/month.

When to pick something else:
- **The maintainers are primarily .NET developers:** choose **B**. It has the best self-hosting story and a strong type system, at the cost of a custom magic link and checking QuestPDF licensing (or using an MIT PDF library).
- **The team prefers Python, or wants a built-in admin for Creator Bans and abuse reports:** choose **C**, but plan to pay $7/month for Render Starter once real Learners arrive, because the one-minute cold start hurts QR-code Verification Pages.
- **Avoid D.** It saves auth code but conflicts with ADR 0002 for Learners, has the weekly pause and SMTP limits, and makes self-hosting heavy.

## Surprising gotchas (summary)

- **Vercel Hobby forbids commercial use**, defined broadly (anyone involved profiting, including a paid developer).
- **Vercel Hobby cron runs once a day at most**, with ±59 min jitter.
- **Render free Postgres is deleted after 30 days**, Render free cron doesn't exist, and a Render service takes about 1 minute to spin up after 15 min idle.
- **Neon pg_cron doesn't fire while the database is scaled to zero**, and Free can't disable scale-to-zero.
- **Supabase free projects pause after 1 week idle**, and the built-in auth SMTP sends 2 emails/hour to pre-authorised addresses only.
- **Email daily caps are the real pilot bottleneck**: Resend free is 100/day, which is about 50 Attempts/day at one code plus one Certificate each.
- **QuestPDF's free license excludes public-sector and publicly traded organisations of any size**, which matters for an OSS project that such organisations might self-host.
- **Lucia (auth) is deprecated** (March 2025).
- **GitHub Actions scheduled workflows auto-disable after 60 days without repository activity** in public repos, so they aren't a set-and-forget sweeper for a quiet project.
