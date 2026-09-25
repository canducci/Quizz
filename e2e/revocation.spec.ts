import { expect, test } from "@playwright/test";
import {
  brandCreator,
  earnCertificate,
  freshNetwork,
  newLearner,
  publishNew,
} from "./learner-helper";
import { signInAsNewCreator } from "./sign-in-helper";

test.use(freshNetwork());

test("a Creator finds a Certificate by the Learner's email and revokes it; the reason stays private", async ({
  page,
  request,
}) => {
  await signInAsNewCreator(page, request);
  await brandCreator(page);
  const link = await publishNew(page, "Revocable skills");
  const email = newLearner();
  const id = await earnCertificate(page, request, link, "Ana Souza", email);

  await page.goto("/certificates");
  await page.getByLabel("Certificate ID, link, or the Learner's email").fill("not an id");
  await page.getByRole("button", { name: "Find" }).click();
  await expect(page.getByText("Enter a Certificate ID")).toBeVisible();

  await page.getByLabel("Certificate ID, link, or the Learner's email").fill(email.toUpperCase());
  await page.getByRole("button", { name: "Find" }).click();
  const card = page.getByRole("article");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Ana Souza · Revocable skills · Version 1");
  await expect(card).toContainText("Valid");
  await card.getByLabel("Reason for revoking").fill("Shared answers in a forum");
  await card.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByRole("status")).toContainText("Certificate revoked.");
  await expect(card).toContainText("Revoked on");
  await expect(card).toContainText("Reason: Shared answers in a forum");
  await expect(card.getByRole("button", { name: "Revoke" })).toHaveCount(0);

  // The same Certificate by its link, as printed under the QR code.
  await page
    .getByLabel("Certificate ID, link, or the Learner's email")
    .fill(`localhost/c/${id.match(/.{4}/g)!.join("-")}`);
  await page.getByRole("button", { name: "Find" }).click();
  await expect(page.getByRole("article")).toContainText("Revoked on");

  await page.goto(`/c/${id}`);
  await expect(page.getByRole("status")).toContainText("The issuer revoked this Certificate on");
  await expect(page.locator(".cert.void .stamp")).toHaveText("Revoked");
  expect(await page.content()).not.toContain("Shared answers");
});
