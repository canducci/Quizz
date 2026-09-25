import { expect, test } from "@playwright/test";
import { signInAsNewCreator } from "./sign-in-helper";

// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("a Creator uploads a logo and sees it served from /files", async ({ page, request }) => {
  await signInAsNewCreator(page, request);
  await page.getByRole("link", { name: "Settings" }).click();

  await page.getByLabel("Creator name").fill("Acme Academy");
  await page.getByLabel("Signer name").fill("Ana Souza");
  await page
    .getByLabel("Logo")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");

  const logo = page.getByRole("img", { name: "Logo" });
  await expect(logo).toHaveAttribute("src", /^\/files\/[0-9a-f-]{36}$/);
  const file = await request.get((await logo.getAttribute("src"))!);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toBe("image/png");
  expect(file.headers()["cache-control"]).toContain("immutable");
  expect(Buffer.compare(await file.body(), PNG)).toBe(0);

  await page.reload();
  await expect(page.getByLabel("Creator name")).toHaveValue("Acme Academy");
  await expect(page.getByLabel("Signer name")).toHaveValue("Ana Souza");
});

test("/files never exposes arbitrary keys", async ({ request }) => {
  expect((await request.get("/files/not-a-key")).status()).toBe(404);
  expect((await request.get("/files/0190a4c2-0000-7000-8000-000000000000")).status()).toBe(404);
});
