import { expect, test, type Page } from "@playwright/test";
import { signInAsNewCreator } from "./sign-in-helper";

// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const option = (page: Page, n: number) => page.getByLabel(`Option ${n}`, { exact: true });
const saved = (page: Page) => expect(page.getByRole("status")).toHaveText("Saved");
async function newQuestion(page: Page, n: number) {
  await page.getByRole("button", { name: "+ New question" }).click();
  await expect(page.getByRole("heading", { name: `Question ${n}` })).toBeVisible();
}

test("a Creator writes a Draft's Question Pool and sees it as a Learner would", async ({
  page,
  request,
}) => {
  await signInAsNewCreator(page, request);
  await page.getByLabel("Assessment title").fill("React basics");
  await page.getByRole("button", { name: "New Assessment" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("React basics");
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  const preview = page.getByRole("region", { name: "Learner preview" });
  const pool = page.getByRole("list", { name: "Question Pool" });

  // Single answer, with Markdown and an uploaded image.
  await newQuestion(page, 1);
  await expect(pool.getByText("incomplete")).toBeVisible();
  await page.getByLabel("Question (Markdown)").fill("What does **JSX** compile to?\n\n");
  await page
    .getByLabel(/Insert image/)
    .setInputFiles({ name: "x.png", mimeType: "image/png", buffer: PNG });
  await expect(preview.getByRole("img", { name: "Describe the image" })).toHaveAttribute(
    "src",
    /^\/files\/[0-9a-f-]{36}$/,
  );
  await option(page, 1).fill("HTML");
  await option(page, 2).fill("`React.createElement` calls");
  await page.getByLabel("Option 2 is correct").check();
  await expect(preview.locator("strong")).toHaveText("JSX");
  await expect(preview.locator("code")).toHaveText("React.createElement");
  await saved(page);
  await expect(pool.getByText("incomplete")).toHaveCount(0);

  // Several answers.
  await newQuestion(page, 2);
  await page.getByLabel("Type").selectOption("multi");
  await page.getByLabel("Question (Markdown)").fill("Which are hooks?");
  await page.getByRole("button", { name: "+ Add option" }).click();
  await option(page, 1).fill("useState");
  await option(page, 2).fill("render");
  await option(page, 3).fill("useEffect");
  await page.getByLabel("Option 1 is correct").check();
  await page.getByLabel("Option 3 is correct").check();
  await expect(preview.getByText("Select all that apply")).toBeVisible();
  await expect(preview.getByRole("checkbox")).toHaveCount(3);
  await saved(page);

  // True / false.
  await newQuestion(page, 3);
  await page.getByLabel("Type").selectOption("truefalse");
  await page.getByLabel("Question (Markdown)").fill("Hooks may run inside loops.");
  await page.getByLabel("Option 2 is correct").check();
  await expect(preview.getByText("True", { exact: true })).toBeVisible();
  await expect(preview.getByText("False", { exact: true })).toBeVisible();
  await saved(page);

  // Everything was stored, and a deleted Question stays gone.
  await page.reload();
  await expect(page.getByText("Questions (3)")).toBeVisible();
  await expect(pool.getByRole("listitem")).toHaveCount(3);
  await expect(pool.getByText("incomplete")).toHaveCount(0);
  await pool.getByRole("button", { name: /Which are hooks/ }).click();
  await expect(page.getByLabel("Option 3 is correct")).toBeChecked();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(pool.getByRole("listitem")).toHaveCount(2);
  await page.reload();
  await expect(pool.getByRole("listitem")).toHaveCount(2);

  await page.getByRole("link", { name: "Assessments" }).click();
  await expect(page.getByRole("link", { name: "React basics" })).toBeVisible();
});
