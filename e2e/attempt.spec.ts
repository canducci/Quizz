import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { brandCreator, freshNetwork, publishNew, verifyLearner } from "./learner-helper";
import { MAILPIT, signInAsNewCreator } from "./sign-in-helper";

type Mail = {
  ID: string;
  Subject: string;
  Text: string;
  Attachments: { PartID: string; FileName: string; ContentType: string }[];
};

/** The email to `email` carrying a PDF; the code email came first and may still be the newest. */
async function mailWithPdf(request: APIRequestContext, email: string) {
  let found: Mail | undefined;
  await expect
    .poll(async () => {
      const search = await request.get(`${MAILPIT}/api/v1/search`, {
        params: { query: `to:"${email}"` },
      });
      for (const { ID } of (await search.json()).messages) {
        const mail: Mail = await (await request.get(`${MAILPIT}/api/v1/message/${ID}`)).json();
        if (mail.Attachments.some((a) => a.ContentType === "application/pdf")) found = mail;
      }
      return !!found;
    })
    .toBe(true);
  return found!;
}

test.use(freshNetwork());
test.describe.configure({ mode: "serial" });

const CSV = `type,question,option_1,option_2,option_3,option_4,option_5,option_6,option_7,option_8,correct,keep_order
single,Which command stages files?,git push,git add,git log,,,,,,2,
multi,Which commands change the working tree?,git checkout,git status,git restore,,,,,,1;3,
truefalse,Git is a distributed version control system.,,,,,,,,,true,
`;
// Options are shuffled, so answers go by label; each Question is found by its text.
const ANSWERS: Record<string, { right: string[]; wrong: string[] }> = {
  "Which command stages files?": { right: ["git add"], wrong: ["git push"] },
  "Which commands change the working tree?": {
    right: ["git checkout", "git restore"],
    wrong: ["git status"],
  },
  "Git is a distributed version control system.": { right: ["True"], wrong: ["False"] },
};

let link = "";

async function answerShown(page: Page, right: boolean) {
  const text = (await page.locator(".qt").innerText()).trim();
  for (const label of ANSWERS[text][right ? "right" : "wrong"])
    await page.getByLabel(label, { exact: true }).check();
  return text;
}

/** Answers from the shown Question to the last, then goes on to the review page. */
async function answerRest(page: Page, right: boolean) {
  const pager = page.locator(".pager");
  while (true) {
    await answerShown(page, right);
    const next = pager.getByRole("button", { name: /Next question|Review & submit/ });
    const last = (await next.innerText()).includes("Review");
    await next.click();
    if (last) break;
  }
  await expect(page.getByRole("heading", { name: "Review and submit" })).toBeVisible();
}

const seconds = (clock: string) => {
  const [m, s] = clock.split(":").map(Number);
  return m * 60 + s;
};

test("a Creator publishes a three-Question Assessment", async ({ page, request }) => {
  await signInAsNewCreator(page, request);
  await brandCreator(page);
  link = await publishNew(page, "Git fundamentals", { csv: CSV });
});

test("a Learner answers every Question right, passes and gets the Certificate PDF by email", async ({
  page,
  request,
}) => {
  const email = await verifyLearner(page, request, link);
  await page.getByRole("button", { name: "Start Attempt" }).click();
  await expect(page.getByRole("timer")).toContainText("saved automatically");
  await expect(page.getByText("Question 1 of 3")).toBeVisible();
  await expect(page.getByRole("button", { name: "Question 1, not answered" })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await answerRest(page, true);
  await expect(page.getByRole("button", { name: /^Question \d, answered$/ })).toHaveCount(3);
  await expect(page.getByRole("cell", { name: "Answered", exact: true })).toHaveCount(3);
  await page.getByLabel("Full name").fill("Ana Souza");
  await page.getByRole("button", { name: "Submit final answers" }).click();
  await expect(page.getByRole("heading", { name: "You passed." })).toBeVisible();
  await expect(page.getByText("Score: 100%")).toBeVisible();
  await expect(page.getByText("Passing Score: 70%.")).toBeVisible();
  // Only the score and pass/fail: nothing names a Question.
  await expect(page.getByText("Which command stages files?")).toHaveCount(0);
  await expect(page.getByText(`Your Certificate is on its way to ${email}.`)).toBeVisible();

  const mail = await mailWithPdf(request, email);
  expect(mail.Subject).toBe("Your Certificate for Git fundamentals");
  expect(mail.Text).toContain("Congratulations, Ana Souza!");
  expect(mail.Text).toMatch(/\/c\/[0-9A-HJKMNP-TV-Z]{16}\b/);
  const pdf = mail.Attachments[0];
  expect(pdf.FileName).toMatch(/^Certificate \w{4}-\w{4}-\w{4}-\w{4}\.pdf$/);
  const part = await request.get(`${MAILPIT}/api/v1/message/${mail.ID}/part/${pdf.PartID}`);
  expect((await part.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("a Learner resumes after a reload with the clock still running, then fails", async ({
  page,
  request,
}) => {
  await verifyLearner(page, request, link);
  await page.getByRole("button", { name: "Start Attempt" }).click();
  const first = await answerShown(page, false);
  await expect(page.getByRole("status")).toHaveText("Saved");
  const before = seconds(await page.getByRole("timer").locator("b").innerText());
  expect(before).toBeLessThanOrEqual(600);

  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.locator(".qt")).toHaveText(first);
  expect(seconds(await page.getByRole("timer").locator("b").innerText())).toBeLessThan(before);
  await expect(page.getByRole("button", { name: "Question 1, answered" })).toBeVisible();
  for (const label of ANSWERS[first].wrong)
    await expect(page.getByLabel(label, { exact: true })).toBeChecked();

  await page.locator(".pager").getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Review & submit" }).first().click();
  await expect(page.getByRole("cell", { name: "Not answered" })).toHaveCount(2);
  await page.getByRole("button", { name: "Change Question 2" }).click();
  await answerRest(page, false);
  await expect(page.getByRole("cell", { name: "Not answered" })).toHaveCount(0);
  await page.getByLabel("Full name").fill("Ana Souza");
  await page.getByRole("button", { name: "Submit final answers" }).click();
  await expect(page.getByRole("heading", { name: "You didn't pass." })).toBeVisible();
  await expect(page.getByText("Score: 0%")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start a new Attempt" })).toBeVisible();
});
