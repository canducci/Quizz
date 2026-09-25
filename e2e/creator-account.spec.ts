import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { brandCreator, earnCertificate, freshNetwork, publishNew } from "./learner-helper";
import { magicLinkFor, signInAsNewCreator } from "./sign-in-helper";

test.use(freshNetwork());

test("a Creator deletes their account; the Certificate they issued still verifies", async ({
  page,
  request,
}) => {
  await signInAsNewCreator(page, request);
  await brandCreator(page);
  const link = await publishNew(page, "Lasting skills");
  const id = await earnCertificate(page, request, link, "Ana Souza");

  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText("Your Creator name stays on the Certificates")).toBeVisible();
  await page.getByRole("button", { name: "Yes, delete my account" }).click();
  await expect(page).toHaveURL(/\/\?deleted=1$/);
  await expect(page.getByRole("status")).toContainText("Your account was deleted.");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/$/);

  await page.goto(`/c/${id}`);
  await expect(page.getByRole("status")).toContainText("Valid Certificate");
  await expect(page.getByText("Issued by Git Academy via Quizz")).toBeVisible();
});

test("the Operator bans a Creator: their Certificates are revoked and they can't sign in", async ({
  page,
  request,
}) => {
  const email = await signInAsNewCreator(page, request);
  await brandCreator(page);
  const link = await publishNew(page, "Impersonated skills");
  const id = await earnCertificate(page, request, link, "Ana Souza");

  const ban = () =>
    execFileSync(
      "docker",
      ["compose", "exec", "-T", "app", "npm", "run", "-s", "operator", "--", "ban", email],
      {
        encoding: "utf8",
      },
    );
  expect(ban()).toContain("1 Certificate(s) revoked");
  expect(ban()).toContain("0 Certificate(s) revoked");

  await page.goto(`/c/${id}`);
  await expect(page.locator(".cert.void .stamp")).toHaveText("Revoked");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/$/);

  // A new magic link is sent, but it no longer signs the Creator in.
  test.setTimeout(test.info().timeout + 90_000);
  const used = await magicLinkFor(request, email);
  await page.getByLabel("Email").fill(email);
  await expect(async () => {
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByRole("status")).toContainText(email, { timeout: 2_000 });
  }).toPass({ intervals: [15_000], timeout: 90_000 });
  let fresh = used;
  await expect.poll(async () => (fresh = await magicLinkFor(request, email))).not.toBe(used);
  await page.goto(fresh);
  await expect(page.getByText("That sign-in didn't work.")).toBeVisible();
  await expect(page).not.toHaveURL(/dashboard/);
});
