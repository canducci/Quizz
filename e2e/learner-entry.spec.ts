import { expect, test } from "@playwright/test";
import { brandCreator, freshNetwork, newLearner, publishNew, requestCode } from "./learner-helper";
import { fromMail, signInAsNewCreator } from "./sign-in-helper";

test.use(freshNetwork());
test.describe.configure({ mode: "serial" });

let publicLink = "";
let inviteLink = "";
let closedLink = "";
let draftLink = "";
const invited = newLearner();

test("a Creator publishes a Public and an Invite-only Assessment", async ({ page, request }) => {
  await signInAsNewCreator(page, request);
  await brandCreator(page);
  publicLink = await publishNew(page, "Git basics");
  inviteLink = await publishNew(page, "Git advanced", { kind: "inviteOnly", invite: invited });
  closedLink = await publishNew(page, "Git antigo", { kind: "inPortuguese" });
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".pill")).toHaveText("Closed · Version 1");
  await page.goto("/dashboard");
  await page.getByLabel("Assessment title").fill("Unfinished");
  await page.getByRole("button", { name: "New Assessment" }).click();
  await expect(page).toHaveURL(/\/assessments\//);
  draftLink = page.url().replace("/assessments/", "/a/");
});

test("a Learner reads the rules, gets a code by email and verifies", async ({ page, request }) => {
  const email = newLearner();
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
  const email = newLearner();
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
  const email = newLearner();
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
