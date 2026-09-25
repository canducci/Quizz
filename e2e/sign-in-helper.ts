import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

/** Waits for the newest email to `email` and returns the first match of `pattern` in it. */
export async function fromMail(request: APIRequestContext, email: string, pattern: RegExp) {
  let found = "";
  await expect
    .poll(async () => {
      const search = await request.get(`${MAILPIT}/api/v1/search`, {
        params: { query: `to:"${email}"` },
      });
      const [message] = (await search.json()).messages;
      if (!message) return "";
      const body = await (await request.get(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
      found = body.Text.match(pattern)?.[0] ?? "";
      return found;
    })
    .not.toBe("");
  return found;
}

export async function magicLinkFor(request: APIRequestContext, email: string) {
  const link = await fromMail(request, email, /https?:\/\/\S+/);
  expect(link).toContain("/api/auth/magic-link/verify");
  return link;
}

/** Signs a fresh Creator in through the magic link and lands on the dashboard.
 * Better Auth allows 5 magic links per IP a minute; past that, this waits the limit out. */
export async function signInAsNewCreator(page: Page, request: APIRequestContext) {
  const email = `creator-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  test.setTimeout(test.info().timeout + 90_000);
  await expect(async () => {
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByRole("status")).toContainText(email, { timeout: 2_000 });
  }).toPass({ intervals: [15_000], timeout: 90_000 });
  await page.goto(await magicLinkFor(request, email));
  await expect(page).toHaveURL(/\/dashboard$/);
}
