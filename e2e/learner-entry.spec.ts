import { expect, test, type Page } from "@playwright/test";
import { fromMail, signInAsNewCreator } from "./sign-in-helper";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const png = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });
const learner = () => `learner-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;

// Each run looks like a new network, so the 10-codes-per-IP limit doesn't carry across runs.
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `10.${Date.now() % 250}.${Math.floor(Math.random() * 250)}.1`,
  },
});
test.describe.configure({ mode: "serial" });

let publicLink = "";
let inviteLink = "";
let closedLink = "";
let draftLink = "";
const invited = learner();

/** A published one-Question Assessment; returns its Learner link. */
async function publishNew(
  page: Page,
  title: string,
  kind: "public" | "inviteOnly" | "inPortuguese",
) {
  await page.goto("/dashboard");
  await page.getByLabel("Assessment title").fill(title);
  await page.getByRole("button", { name: "New Assessment" }).click();
  await expect(page).toHaveURL(/\/assessments\//);
  const editor = page.url();
  await page.goto(`${editor}?tab=rules`);
  await page.getByLabel(/Questions per Attempt/).fill("1");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  if (kind !== "public") {
    await page.goto(`${editor}?tab=access`);
    if (kind === "inPortuguese") await page.getByLabel(/Assessment Language/).selectOption("pt-BR");
    else await page.getByLabel(/Access Mode/).selectOption("invite");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved");
  }
  if (kind === "inviteOnly") {
    await page.getByLabel("Emails").fill(invited);
    await page.getByRole("button", { name: "Invite" }).click();
    await expect(page.getByRole("heading", { name: "1 email invited" })).toBeVisible();
  }
  await page.goto(editor);
  await page.getByRole("button", { name: "+ New question" }).click();
  await page.getByLabel("Question (Markdown)").fill("Is this a test?");
  await page.getByLabel("Option 1", { exact: true }).fill("Yes");
  await page.getByLabel("Option 2", { exact: true }).fill("No");
  await page.getByLabel("Option 1 is correct").check();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.locator(".topbar").getByRole("button").click();
  await expect(page.locator(".pill")).toHaveText("Published · Version 1");
  await page.goto(`${editor}?tab=publish`);
  return (await page.locator('a[href*="/a/"]').getAttribute("href"))!;
}

async function requestCode(page: Page, link: string, email: string) {
  await page.goto(link);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send verification code" }).click();
  await expect(page.getByText(`Sent to ${email}`)).toBeVisible();
}

test("a Creator publishes a Public and an Invite-only Assessment", async ({ page, request }) => {
  await signInAsNewCreator(page, request);
  await page.goto("/settings");
  await page.getByLabel("Creator name").fill("Git Academy");
  await page.getByLabel("Signer name").fill("Ana Souza");
  await page.getByLabel("Logo").setInputFiles(png("logo.png"));
  await page.getByLabel("Signature image").setInputFiles(png("signature.png"));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  publicLink = await publishNew(page, "Git basics", "public");
  inviteLink = await publishNew(page, "Git advanced", "inviteOnly");
  closedLink = await publishNew(page, "Git antigo", "inPortuguese");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".pill")).toHaveText("Closed · Version 1");
  await page.goto("/dashboard");
  await page.getByLabel("Assessment title").fill("Unfinished");
  await page.getByRole("button", { name: "New Assessment" }).click();
  await expect(page).toHaveURL(/\/assessments\//);
  draftLink = page.url().replace("/assessments/", "/a/");
});

test("a Learner reads the rules, gets a code by email and verifies", async ({ page, request }) => {
  const email = learner();
  await page.goto(publicLink);
  await expect(page.getByRole("heading", { name: "Git basics" })).toBeVisible();
  await expect(page.getByText("Issued by Git Academy")).toBeVisible();
  await expect(page.getByRole("cell", { name: "1, drawn at random" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "10 minutes" })).toBeVisible();
  await requestCode(page, publicLink, email);
  const code = await fromMail(request, email, /\b\d{6}\b/);
  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("status")).toHaveText(`Email verified: ${email}.`);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText(`Email verified: ${email}.`);
});

test("5 wrong codes lock the code, even against the right one", async ({ page, request }) => {
  const email = learner();
  await requestCode(page, publicLink, email);
  const code = await fromMail(request, email, /\b\d{6}\b/);
  const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
  const verify = page.getByRole("button", { name: "Verify" });
  for (const left of ["4 tries", "3 tries", "2 tries", "1 try"]) {
    await page.getByLabel("Verification code").fill(wrong);
    await verify.click();
    await expect(page.locator(".paper [role=alert]")).toHaveText(
      `That code isn't right. ${left} left.`,
    );
  }
  await page.getByLabel("Verification code").fill(wrong);
  await verify.click();
  await expect(page.locator(".paper [role=alert]")).toHaveText(
    "Too many wrong tries. Request a new code.",
  );
  await page.getByLabel("Verification code").fill(code);
  await verify.click();
  await expect(page.locator(".paper [role=alert]")).toHaveText(
    "Too many wrong tries. Request a new code.",
  );
});

test("an uninvited email is told so only after its code", async ({ page, request }) => {
  const email = learner();
  await page.goto(inviteLink);
  await expect(page.getByText("Only invited emails can take this Assessment.")).toBeVisible();
  await requestCode(page, inviteLink, email);
  await page.getByLabel("Verification code").fill(await fromMail(request, email, /\b\d{6}\b/));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.locator(".paper [role=alert]")).toHaveText(
    "This email isn't invited. Ask Git Academy.",
  );

  await page.getByRole("button", { name: "Use another email" }).click();
  await requestCode(page, inviteLink, invited);
  await page.getByLabel("Verification code").fill(await fromMail(request, invited, /\b\d{6}\b/));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("status")).toHaveText(`Email verified: ${invited}.`);
});

test("a Closed Assessment says so in its language with the Creator's name; a Draft is not found", async ({
  page,
}) => {
  await page.goto(closedLink);
  await expect(page.locator(".paper [role=alert]")).toHaveText(
    "Esta Avaliação está encerrada. Git Academy não está aceitando novas Tentativas.",
  );
  await expect(page.getByLabel("Email address")).toHaveCount(0);
  expect((await page.goto(draftLink))?.status()).toBe(404);
});
