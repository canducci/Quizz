import { solveChallenge, type Challenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/sha";
import { describe, expect, it } from "vitest";
import { captchaPassed, newCaptcha } from "./captcha";

const ENV = { BETTER_AUTH_SECRET: "test-secret", CAPTCHA_DIFFICULTY: "1000" };

/** What the browser sends back: base64 of the challenge and its solution. */
async function solved(challenge: Challenge) {
  const solution = await solveChallenge({ challenge, deriveKey });
  return Buffer.from(JSON.stringify({ challenge, solution })).toString("base64");
}

describe("captchaPassed", () => {
  it("accepts a solved challenge once", async () => {
    const payload = await solved(await newCaptcha(new Date(), ENV));
    expect(await captchaPassed(payload, ENV)).toBe(true);
    expect(await captchaPassed(payload, ENV)).toBe(false);
  });

  it("refuses a missing or malformed token", async () => {
    for (const payload of [undefined, null, "", 42, "not base64 json", btoa("{}")])
      expect(await captchaPassed(payload, ENV)).toBe(false);
  });

  it("refuses a challenge signed with another secret", async () => {
    const payload = await solved(await newCaptcha(new Date(), { ...ENV, BETTER_AUTH_SECRET: "x" }));
    expect(await captchaPassed(payload, ENV)).toBe(false);
  });

  it("refuses a challenge whose parameters were changed", async () => {
    const challenge = await newCaptcha(new Date(), ENV);
    challenge.parameters.expiresAt! += 3600;
    expect(await captchaPassed(await solved(challenge), ENV)).toBe(false);
  });

  it("refuses an unsigned challenge", async () => {
    const unsigned = await newCaptcha(new Date(), ENV);
    delete unsigned.signature;
    expect(await captchaPassed(await solved(unsigned), ENV)).toBe(false);
  });

  it("refuses a wrong solution", async () => {
    const challenge = await newCaptcha(new Date(), ENV);
    const solution = { counter: 1, derivedKey: "00".repeat(32) };
    const payload = Buffer.from(JSON.stringify({ challenge, solution })).toString("base64");
    expect(await captchaPassed(payload, ENV)).toBe(false);
  });

  it("refuses a challenge older than 10 minutes", async () => {
    const issued = new Date(Date.now() - 11 * 60_000);
    expect(await captchaPassed(await solved(await newCaptcha(issued, ENV)), ENV)).toBe(false);
  });
});
