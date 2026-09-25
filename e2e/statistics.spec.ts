import { expect, test } from "@playwright/test";
import { brandCreator, publishNew, sql } from "./learner-helper";
import { signInAsNewCreator } from "./sign-in-helper";

const day = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 24 * 60 * 60_000).toISOString().slice(0, 10);

test("the Statistics tab shows the seeded counters as tiles and tables", async ({
  page,
  request,
}) => {
  await signInAsNewCreator(page, request);
  await brandCreator(page);
  await publishNew(page, "Counted skills");
  const editor = page.url().split("?")[0];
  const assessmentId = editor.split("/").pop()!;

  await page.goto(`${editor}?tab=statistics`);
  await expect(page.getByRole("heading", { name: "No Attempts in this range" })).toBeVisible();

  // Today: 4 Attempts, 1 Timed out, 3 submitted, 2 passed. 20 days ago: 1 more, failed, and the
  // Question it drew wrong three times over (seeded counters needn't add up).
  const seed = (
    daysAgo: number,
    counters: number[],
    scores: object,
    times: object,
    [shown, correct]: number[],
  ) =>
    sql(
      `insert into stats_day (version_id, day, attempts, timed_out, submitted, passed,
        certificates_issued, revoked, expired, score_histogram, time_histogram, questions)
       select id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
         json_object(json_extract(snapshot, '$.questions[0].id'), json_object('shown', ?, 'correct', ?))
       from assessment_version where assessment_id = ?`,
      day(daysAgo),
      ...counters,
      JSON.stringify(scores),
      JSON.stringify(times),
      shown,
      correct,
      assessmentId,
    );
  seed(0, [4, 1, 3, 2, 2, 1, 0], { 100: 2, 0: 1 }, { 3: 2, 6: 1 }, [3, 2]);
  seed(20, [1, 0, 1, 0, 0, 0, 0], { 0: 1 }, { 9: 1 }, [3, 0]);

  await page.goto(`${editor}?tab=statistics&range=7`);
  const tile = (label: string) => page.locator(".tile").filter({ hasText: label });
  await expect(tile("Attempts")).toContainText("41 Timed out");
  await expect(tile("Pass rate")).toContainText("50%2 passed");
  await expect(tile("Median time")).toContainText("3 min");
  await expect(tile("Certificates issued")).toContainText("21 revoked · 0 expired");
  await expect(tile("Questions to review")).toContainText("0all above 50% correct");

  const scores = page.locator(".card").filter({ hasText: "Score distribution" });
  await scores.getByText("Show as table").click();
  await expect(scores.getByRole("row", { name: "90–100% 2" })).toBeVisible();
  await expect(scores.getByRole("row", { name: "0–9% 1" })).toBeVisible();

  // The longer range adds the older day; one Version shows its Passing Score.
  await page.getByRole("link", { name: "Last 30 days" }).click();
  await expect(tile("Attempts")).toContainText("51 Timed out");
  await expect(tile("Questions to review")).toContainText("1⚠ below 50% correct");
  await page.getByRole("link", { name: /^Version 1/ }).click();
  await expect(page.getByText(/^Passing Score \d+%$/)).toBeVisible();
  const questions = page.locator(".card").filter({ hasText: "Correct-answer rate" });
  await questions.getByText("Show as table").click();
  await expect(questions.getByRole("row", { name: "Q1 Is this a test? 33% ⚠ 6" })).toBeVisible();
});
