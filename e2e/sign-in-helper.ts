import { expect, type APIRequestContext, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

export async function magicLinkFor(request: APIRequestContext, email: string) {
  let link = "";
  await expect
    .poll(async () => {
      const search = await request.get(`${MAILPIT}/api/v1/search`, {
        params: { query: `to:"${email}"` },
      });
      const [message] = (await search.json()).messages;
      if (!message) return "";
      const body = await (await request.get(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
      link = body.Text.match(/https?:\/\/\S+/)?.[0] ?? "";
      return link;
    })
    .toContain("/api/auth/magic-link/verify");
  return link;
}

/** Better Auth rate-limits magic links per IP: keep sign-ins per run few.
 * Signs a fresh Creator in through the magic link and lands on the dashboard. */
export async function signInAsNewCreator(page: Page, request: APIRequestContext) {
  const email = `creator-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText(email);
  await page.goto(await magicLinkFor(request, email));
  await expect(page).toHaveURL(/\/dashboard$/);
}
