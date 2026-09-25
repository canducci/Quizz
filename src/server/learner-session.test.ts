import { expect, it } from "vitest";
import { learnerEmail, learnerToken } from "./learner-session";

it("proves a verified email for one Assessment for a day", () => {
  const now = new Date(Date.UTC(2026, 8, 25));
  const token = learnerToken("a1", "ana@example.com", now, "s");
  expect(learnerEmail(token, "a1", now, "s")).toBe("ana@example.com");
  expect(learnerEmail(token, "a2", now, "s")).toBeNull();
  expect(learnerEmail(token, "a1", new Date(now.getTime() + 25 * 3600_000), "s")).toBeNull();
  expect(learnerEmail(token, "a1", now, "other secret")).toBeNull();
  expect(Buffer.from(token, "base64url").toString()).not.toContain("ana@");
  const flipped = Buffer.from(token, "base64url");
  flipped[flipped.length - 1] ^= 1;
  expect(learnerEmail(flipped.toString("base64url"), "a1", now, "s")).toBeNull();
  expect(learnerEmail(undefined, "a1", now, "s")).toBeNull();
  expect(learnerEmail("junk", "a1", now, "s")).toBeNull();
});
