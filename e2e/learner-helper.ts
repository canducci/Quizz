import { execFileSync } from "node:child_process";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { fromMail } from "./sign-in-helper";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const png = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });

export const newLearner = () =>
  `learner-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;

/** Each run looks like a new network, so the 10-codes-per-IP limit doesn't carry across runs. */
export const freshNetwork = () => ({
  extraHTTPHeaders: {
    "x-forwarded-for": `10.${Date.now() % 250}.${Math.floor(Math.random() * 250)}.1`,
  },
});

/** Gives the signed-in Creator the branding publishing needs. */
export async function brandCreator(page: Page) {
  await page.goto("/settings");
  await page.getByLabel("Creator name").fill("Git Academy");
  await page.getByLabel("Signer name").fill("Ana Souza");
  await page.getByLabel("Logo").setInputFiles(png("logo.png"));
  await page.getByLabel("Signature image").setInputFiles(png("signature.png"));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
}

/** Publishes a new Assessment and returns its Learner link. Without `csv` it has one Question;
 * with it, the CSV's Questions, all drawn. */
export async function publishNew(
  page: Page,
  title: string,
  opts: { kind?: "public" | "inviteOnly" | "inPortuguese"; invite?: string; csv?: string } = {},
) {
  const kind = opts.kind ?? "public";
  await page.goto("/dashboard");
  await page.getByLabel("Assessment title").fill(title);
  await page.getByRole("button", { name: "New Assessment" }).click();
  await expect(page).toHaveURL(/\/assessments\//);
  const editor = page.url();
  const rows = opts.csv ? opts.csv.trim().split("\n").length - 1 : 1;
  await page.goto(`${editor}?tab=rules`);
  await page.getByLabel(/Questions per Attempt/).fill(String(rows));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  if (kind !== "public") {
    await page.goto(`${editor}?tab=access`);
    if (kind === "inPortuguese") await page.getByLabel(/Assessment Language/).selectOption("pt-BR");
    else await page.getByLabel(/Access Mode/).selectOption("invite");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved");
  }
  if (opts.invite) {
    await page.getByLabel("Emails").fill(opts.invite);
    await page.getByRole("button", { name: "Invite" }).click();
    await expect(page.getByRole("heading", { name: "1 email invited" })).toBeVisible();
  }
  await page.goto(editor);
  if (opts.csv) {
    await page.getByLabel("Import from CSV").setInputFiles({
      name: "questions.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(opts.csv),
    });
    await expect(page.getByText(`Imported ${rows} Questions.`)).toBeVisible();
  } else {
    await page.getByRole("button", { name: "+ New question" }).click();
    await page.getByLabel("Question (Markdown)").fill("Is this a test?");
    await page.getByLabel("Option 1", { exact: true }).fill("Yes");
    await page.getByLabel("Option 2", { exact: true }).fill("No");
    await page.getByLabel("Option 1 is correct").check();
    await expect(page.getByRole("status")).toHaveText("Saved");
  }
  await page.locator(".topbar").getByRole("button").click();
  await expect(page.locator(".pill")).toHaveText("Published · Version 1");
  await page.goto(`${editor}?tab=publish`);
  return (await page.locator('a[href*="/a/"]').getAttribute("href"))!;
}

export async function requestCode(page: Page, link: string, email: string) {
  await page.goto(link);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send verification code" }).click();
  await expect(page.getByText(`Sent to ${email}`)).toBeVisible();
}

/** Proves a Learner's email on the Assessment link, leaving the page on the verified view. */
export async function verifyLearner(
  page: Page,
  request: APIRequestContext,
  link: string,
  email = newLearner(),
) {
  await requestCode(page, link, email);
  await page.getByLabel("Verification code").fill(await fromMail(request, email, /\b\d{6}\b/));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("status")).toHaveText(`Email verified: ${email}.`);
  return email;
}

/** Runs SQL in the app container: the one way to seed states nothing in the UI reaches yet. */
export function sql(query: string, ...args: (string | number | null)[]) {
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
