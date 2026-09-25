import { expect, test } from "@playwright/test";
import { signInAsNewCreator } from "./sign-in-helper";

test("a Creator sets the Rules and invites Learners by email", async ({ page, request }) => {
  await signInAsNewCreator(page, request);
  await page.getByLabel("Assessment title").fill("Security basics");
  await page.getByRole("button", { name: "New Assessment" }).click();

  // Rules.
  await page.getByRole("link", { name: "Rules" }).click();
  await page.getByLabel(/Questions per Attempt/).fill("3");
  await page.getByLabel(/Time limit/).fill("20");
  await page.getByLabel(/Passing Score/).fill("80");
  await page.getByLabel(/Attempts allowed/).fill("3");
  await page.getByLabel(/Cooldown/).fill("0");
  await expect(page.getByLabel(/Expiry/)).toHaveValue("");
  await page.getByLabel(/Expiry/).selectOption("365");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByLabel(/Passing Score/)).toHaveValue("80");
  await expect(page.getByLabel(/Cooldown/)).toHaveValue("0");
  await expect(page.getByLabel(/Expiry/)).toHaveValue("365");

  // Access & language: Invite-only, then paste emails.
  await page.getByRole("link", { name: "Access & language" }).click();
  await expect(page.getByLabel(/Access Mode/)).toHaveValue("public");
  await page.getByLabel(/Assessment Language/).selectOption("pt-BR");
  await page.getByLabel(/Access Mode/).selectOption("invite");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Nobody invited yet" })).toBeVisible();

  const emails = page.getByLabel("Emails");
  await emails.fill("ana@example.test, BO@example.test\nbo@example.test typo");
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByRole("heading", { name: "2 emails invited" })).toBeVisible();
  await expect(page.getByText("1 entry isn't an email")).toBeVisible();
  await expect(emails).toHaveValue("");

  await emails.fill("ana@example.test");
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText("No new emails invited.")).toBeVisible();

  await emails.fill(" Ana@Example.test ");
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("heading", { name: "1 email invited" })).toBeVisible();

  // Only the count is kept: the emails themselves are nowhere on the page.
  await page.reload();
  await expect(page.getByRole("heading", { name: "1 email invited" })).toBeVisible();
  await expect(page.getByLabel(/Assessment Language/)).toHaveValue("pt-BR");
  await expect(page.getByText("example.test")).toHaveCount(0);
});
