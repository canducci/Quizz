import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { signInAsNewCreator } from "./sign-in-helper";

test("a Creator imports the CSV template, and a bad file changes nothing", async ({
  page,
  request,
}) => {
  await signInAsNewCreator(page, request);
  await page.getByLabel("Assessment title").fill("CSV basics");
  await page.getByRole("button", { name: "New Assessment" }).click();
  const pool = page.getByRole("list", { name: "Question Pool" });
  const questionsTab = page.getByRole("link", { name: /^Questions/ });

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download the CSV template" }).click();
  const template = await readFile(await (await download).path());

  const importCsv = page.getByLabel("Import from CSV");
  await importCsv.setInputFiles({ name: "questions.csv", mimeType: "text/csv", buffer: template });
  await expect(page.getByText("Imported 3 Questions.")).toBeVisible();
  await expect(pool.getByRole("listitem")).toHaveCount(3);
  await expect(pool).toContainText("Which are React hooks?");
  await expect(pool.getByText("incomplete")).toHaveCount(0);
  await expect(questionsTab).toHaveText("Questions (3)");

  const bad = [
    "type,question,option_1,option_2,correct,keep_order",
    'single,"Fine, with a comma",a,b,1,',
    "essay,Q,a,b,1,",
    "multi,Q,a,b,3,",
  ].join("\n");
  await importCsv.setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(bad),
  });
  const alert = page.getByRole("alert").filter({ hasText: "Nothing was imported." });
  await expect(alert).toContainText("Nothing was imported.");
  await expect(alert.getByRole("listitem")).toHaveText([
    "Row 3: type must be single, multi or truefalse.",
    /^Row 4: correct must name filled options/,
  ]);
  await page.reload();
  await expect(pool.getByRole("listitem")).toHaveCount(3);
  await expect(questionsTab).toHaveText("Questions (3)");
});
