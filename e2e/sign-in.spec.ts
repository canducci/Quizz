import { expect, test, type APIRequestContext } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

async function magicLinkFor(request: APIRequestContext, email: string) {
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

test("a Creator signs in with a magic link, sees the empty dashboard, and switches to PT", async ({
  page,
  request,
}) => {
  const email = `creator-${Date.now()}@example.test`;

  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText(email);

  await page.goto(await magicLinkFor(request, email));
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Your Assessments" })).toBeVisible();
  await expect(page.getByText("No Assessments yet.")).toBeVisible();

  await page.getByRole("button", { name: "PT" }).click();
  await expect(page.getByRole("heading", { name: "Suas Avaliações" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
});
