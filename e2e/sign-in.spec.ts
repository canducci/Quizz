import { expect, test } from "@playwright/test";
import { mailsTo, signInAsNewCreator } from "./sign-in-helper";

test("a Creator signs in with a magic link, sees the empty dashboard, and switches to PT", async ({
  page,
  request,
}) => {
  await signInAsNewCreator(page, request);
  await expect(page.getByRole("heading", { name: "Your Assessments" })).toBeVisible();
  await expect(page.getByText("No Assessments yet.")).toBeVisible();

  await page.getByRole("button", { name: "PT" }).click();
  await expect(page.getByRole("heading", { name: "Suas Avaliações" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
});

test("a sign-in link request without a solved CAPTCHA is refused and sends no email", async ({
  request,
  baseURL,
}) => {
  const email = `captcha-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  for (const captcha of [undefined, "bm90IGEgc29sdXRpb24="]) {
    const response = await request.post("/api/auth/sign-in/magic-link", {
      data: { email, callbackURL: "/dashboard" },
      headers: {
        origin: baseURL!,
        "x-forwarded-for": `10.${Date.now() % 250}.${Math.floor(Math.random() * 250)}.2`,
        ...(captcha && { "x-captcha": captcha }),
      },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).code).toBe("CAPTCHA_FAILED");
  }
  // A sent link lands within a second or two; give it time to show up if one went out.
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  expect(await mailsTo(request, email)).toHaveLength(0);
});
