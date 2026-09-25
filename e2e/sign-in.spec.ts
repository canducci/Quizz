import { expect, test } from "@playwright/test";
import { signInAsNewCreator } from "./sign-in-helper";

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
