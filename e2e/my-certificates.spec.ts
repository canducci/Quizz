import { expect, test } from "@playwright/test";
import {
  brandCreator,
  earnCertificate,
  freshNetwork,
  newLearner,
  publishNew,
} from "./learner-helper";
import { fromMail, signInAsNewCreator } from "./sign-in-helper";

test.use(freshNetwork());

test("a Learner corrects their name, then erases everything", async ({ page, request }) => {
  await signInAsNewCreator(page, request);
  await brandCreator(page);
  const link = await publishNew(page, "Correctable skills");
  const email = newLearner();
  const old = await earnCertificate(page, request, link, "Ana Suoza", email);

  await page.goto("/");
  await page.getByRole("link", { name: "My Certificates" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send verification code" }).click();
  await page.getByLabel("Verification code").fill(await fromMail(request, email, /\b\d{6}\b/));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText(`Showing Certificates for ${email}.`)).toBeVisible();
  const card = page.getByRole("article");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Correctable skills · Git Academy · Version 1");
  await expect(card).toContainText("Ana Suoza · 100%");

  await card.getByRole("button", { name: "Correct my name" }).click();
  await card.getByLabel("Full name, as it should appear").fill("Ana Souza");
  await card.getByRole("button", { name: "Issue corrected Certificate" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your corrected Certificate is at a new link",
  );
  const fresh = (await fromMail(request, email, /\/c\/[0-9A-Z]{16}\b/)).slice(3);
  expect(fresh).not.toBe(old);
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByRole("article").filter({ hasText: "Replaced on" })).toContainText(
    "Ana Suoza",
  );

  await page.goto(`/c/${old}`);
  await expect(page.getByRole("status")).toContainText("this Certificate was replaced");
  await expect(page.locator(".cert.void .stamp")).toHaveText("Replaced");
  await expect(page.locator(`a[href*="${fresh}"]`)).toHaveCount(0);
  expect(await page.content()).not.toContain("Name correction");
  await page.goto(`/c/${fresh}`);
  await expect(page.getByRole("status")).toContainText("Valid Certificate");
  await expect(page.locator(".cert")).toContainText("Ana Souza");

  await page.goto("/me");
  await page.getByRole("button", { name: "Delete all my data" }).click();
  await page.getByRole("button", { name: "Yes, delete everything" }).click();
  await expect(page.getByRole("status")).toHaveText("Your data has been deleted.");
  await expect(page.getByLabel("Email address")).toBeVisible();
  for (const id of [old, fresh]) {
    await page.goto(`/c/${id}`);
    await expect(page.getByRole("status")).toContainText("Certificate not found");
  }
});
