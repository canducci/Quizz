import { execFileSync } from "node:child_process";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { brandCreator, freshNetwork, publishNew, verifyLearner } from "./learner-helper";
import { fromMail, signInAsNewCreator } from "./sign-in-helper";

test.use(freshNetwork());
test.describe.configure({ mode: "serial" });

/** Runs SQL in the app container: the one way to seed states nothing in the UI reaches yet. */
function sql(query: string, ...args: (string | number | null)[]) {
  // The app writes too, from parallel tests: wait for its lock instead of failing SQLITE_BUSY.
  const run = `const db = require("@libsql/client").createClient({ url: process.env.DATABASE_URL });
    db.execute("pragma busy_timeout = 5000")
      .then(() => db.execute({ sql: process.argv[1], args: JSON.parse(process.argv[2]) }))`;
  execFileSync("docker", [
    "compose",
    "exec",
    "-T",
    "app",
    "node",
    "-e",
    run,
    query,
    JSON.stringify(args),
  ]);
}

const DAY = 24 * 60 * 60_000;
let id = "";
const dashed = () => id.match(/.{4}/g)!.join("-");
/** Sets every column a state reads, so no test depends on the one before it. */
const seed = (
  status: string,
  statusAt: number | null,
  expiresAt: number | null,
  reason: string | null,
) =>
  sql(
    "update certificate set status = ?, status_at = ?, expires_at = ?, revocation_reason = ? where public_id = ?",
    status,
    statusAt,
    expiresAt,
    reason,
    id,
  );
const pdfStatus = async (request: APIRequestContext) =>
  (await request.get(`/c/${id}/pdf`)).status();

test("a Learner earns a Certificate", async ({ page, request }) => {
  await signInAsNewCreator(page, request);
  await brandCreator(page);
  const link = await publishNew(page, "Verified skills");
  const email = await verifyLearner(page, request, link);
  await page.getByRole("button", { name: "Start Attempt" }).click();
  await page.getByLabel("Yes", { exact: true }).check();
  await page.locator(".pager").getByRole("button", { name: "Review & submit" }).click();
  await page.getByLabel("Full name").fill("Ana Souza");
  await page.getByRole("button", { name: "Submit final answers" }).click();
  await expect(page.getByRole("heading", { name: "You passed." })).toBeVisible();
  id = (await fromMail(request, email, /\/c\/[0-9A-Z]{16}\b/)).slice(3);
});

test("valid: the drawing, facts, issuer, Download PDF and a report link", async ({
  page,
  request,
}) => {
  seed("valid", null, Date.UTC(2099, 0, 15), null);
  await page.goto(`/c/${dashed()}`);
  await expect(page.getByRole("status")).toContainText("Valid Certificate");
  await expect(page.locator(".stamp")).toHaveCount(0);
  await expect(page.locator(".cert")).toContainText("This certifies that");
  await expect(page.locator(".cert")).toContainText("Ana Souza");
  await expect(page.locator(".cert")).toContainText("Valid until January 15, 2099");
  await expect(page.locator("dl")).toContainText("Verified skills · Version 1");
  await expect(page.locator("dl")).toContainText("100% (Passing Score 70%)");
  await expect(page.locator("dl")).toContainText(dashed());
  await expect(page.getByText("Issued by Git Academy via Quizz")).toBeVisible();
  await expect(page.getByText(/^On Quizz since /)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Report a problem with this issuer" }),
  ).toHaveAttribute(
    "href",
    `mailto:operator@quizz.localhost?subject=${encodeURIComponent(`Problem with Certificate ${dashed()}`)}`,
  );
  const pdf = await request.get(
    (await page.getByRole("link", { name: "Download PDF" }).getAttribute("href"))!,
  );
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // The id works without dashes and in lower case; PT changes the labels, not the Certificate.
  await page.goto(`/c/${id.toLowerCase()}`);
  await page.getByRole("button", { name: "PT" }).click();
  await expect(page.getByRole("status")).toContainText("Certificado válido");
  await expect(page.getByRole("link", { name: "Baixar PDF" })).toBeVisible();
  await expect(page.locator(".cert")).toContainText("This certifies that");
});

test("expired: stamped, with its date, no download", async ({ page, request }) => {
  seed("valid", null, Date.now() - DAY, null);
  await page.goto(`/c/${id}`);
  await expect(page.getByRole("status")).toContainText(
    "This Certificate was genuine but expired on",
  );
  await expect(page.locator(".cert.void .stamp")).toHaveText("Expired");
  await expect(page.getByRole("link", { name: "Download PDF" })).toHaveCount(0);
  expect(await pdfStatus(request)).toBe(404);
});

test("revoked: its date, never its reason", async ({ page, request }) => {
  seed("revoked", Date.UTC(2026, 7, 2), null, "Shared answers in a forum");
  await page.goto(`/c/${id}`);
  await expect(page.getByRole("status")).toContainText(
    "The issuer revoked this Certificate on August 2, 2026.",
  );
  await expect(page.locator(".cert.void .stamp")).toHaveText("Revoked");
  await expect(page.getByText("Shared answers")).toHaveCount(0);
  expect(await page.content()).not.toContain("Shared answers");
  expect(await pdfStatus(request)).toBe(404);
});

test("replaced: its date, no link to the replacement", async ({ page, request }) => {
  seed("replaced", Date.UTC(2026, 7, 2), null, "Name correction");
  await page.goto(`/c/${id}`);
  await expect(page.getByRole("status")).toContainText(
    "On August 2, 2026 this Certificate was replaced by a corrected one.",
  );
  await expect(page.locator(".cert.void .stamp")).toHaveText("Replaced");
  await expect(page.locator('a[href*="/c/"]')).toHaveCount(0);
  expect(await pdfStatus(request)).toBe(404);
});

test("not found: the status only", async ({ page }) => {
  await page.goto("/c/0000-0000-0000-0000");
  await expect(page.getByRole("status")).toContainText("Certificate not found");
  await expect(page.locator(".cert, dl")).toHaveCount(0); // A stray % in the address is just another id that isn't there.
  await page.goto("/c/100%25");
  await expect(page.getByRole("status")).toContainText("Certificate not found");
});
