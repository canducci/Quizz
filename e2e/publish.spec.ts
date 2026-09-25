import { expect, test } from "@playwright/test";
import { signInAsNewCreator } from "./sign-in-helper";

// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const png = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });

test("a Creator publishes, edits and publishes Version 2, then closes and reopens", async ({
  page,
  request,
}) => {
  await signInAsNewCreator(page, request);

  // A Draft that can't be published yet: nothing in the pool, no branding.
  await page.getByLabel("Assessment title").fill("Git basics");
  await page.getByRole("button", { name: "New Assessment" }).click();
  await page.getByRole("link", { name: "Publish" }).click();
  const problems = page.locator(".problems");
  await expect(problems).toContainText(
    "The Question Pool has 0 Questions but each Attempt draws 5",
  );
  await expect(problems).toContainText("logo, signer name, and signature image");
  const publish = page.locator(".topbar").getByRole("button");
  await expect(publish).toHaveText("Publish");
  await expect(publish).toBeDisabled();
  const editor = page.url();

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Creator name").fill("Git Academy");
  await page.getByLabel("Signer name").fill("Ana Souza");
  await page.getByLabel("Logo").setInputFiles(png("logo.png"));
  await page.getByLabel("Signature image").setInputFiles(png("signature.png"));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");

  await page.goto(editor.replace("tab=publish", "tab=rules"));
  await page.getByLabel(/Questions per Attempt/).fill("1");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  await page.getByRole("link", { name: /^Questions/ }).click();
  await page.getByRole("button", { name: "+ New question" }).click();
  await page.getByLabel("Question (Markdown)").fill("What does `git init` create?");
  await page.getByLabel("Option 1", { exact: true }).fill("A repository");
  await page.getByLabel("Option 2", { exact: true }).fill("A branch");
  await page.getByLabel("Option 1 is correct").check();
  await expect(page.getByRole("status")).toHaveText("Saved");

  // Ready: publish Version 1.
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page.locator(".pill")).toHaveText("Published · v1");
  await expect(publish).toHaveText("Published · Version 1");
  await expect(publish).toBeDisabled();
  await expect(page.getByText("No unpublished changes.")).toBeVisible();

  // Editing shows that publishing makes Version 2 and Certificates stay on Version 1.
  await page.getByRole("link", { name: /^Questions/ }).click();
  await page.getByLabel("Question (Markdown)").fill("What does `git init` make?");
  await expect(page.getByRole("status")).toHaveText("Saved");
  await expect(page.getByText(/Publishing creates Version 2; .* stay on Version 1/)).toBeVisible();
  await publish.click();
  await expect(page.locator(".pill")).toHaveText("Published · v2");
  await expect(page.getByText(/Publishing creates Version/)).toHaveCount(0);

  // Close, then reopen. A published Assessment can't be deleted.
  await expect(page.getByRole("button", { name: "Delete Assessment" })).toHaveCount(0);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".pill")).toHaveText("Closed · v2");
  await page.getByRole("button", { name: "Reopen" }).click();
  await expect(page.locator(".pill")).toHaveText("Published · v2");

  // A Draft can be deleted.
  await page.goto("/dashboard");
  await page.getByLabel("Assessment title").fill("Throwaway");
  await page.getByRole("button", { name: "New Assessment" }).click();
  await page.getByRole("link", { name: "Publish" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete Assessment" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: "Throwaway" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Git basics" })).toBeVisible();
});
