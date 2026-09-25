import { describe, expect, it } from "vitest";
import { retakeBlock, type PastAttempt, type HeldCertificate } from "./retake";

const MINUTE = 60_000;
const at = (minutes: number) => new Date(Date.UTC(2026, 8, 25, 12) + minutes * MINUTE);
const rules = { maxAttempts: 2, cooldown: 60 };

/** An Attempt started at `start` and submitted at `end` minutes, with a 10-minute deadline. */
const submitted = (start: number, end: number): PastAttempt => ({
  startedAt: at(start),
  deadline: at(start + 10),
  submittedAt: at(end),
});
const timedOut = (start: number): PastAttempt => ({
  startedAt: at(start),
  deadline: at(start + 10),
  submittedAt: null,
});
const cert = (c: Partial<HeldCertificate> = {}): HeldCertificate => ({
  publicId: "P",
  status: "valid",
  statusAt: null,
  expiresAt: null,
  ...c,
});

describe("retakeBlock", () => {
  it("lets a first Attempt start", () => {
    expect(retakeBlock([], [], rules, at(0))).toBeNull();
  });

  it("runs the cooldown from the submit, and lets the next Attempt start once it's over", () => {
    const past = [submitted(0, 5)];
    expect(retakeBlock(past, [], rules, at(64))).toEqual({ reason: "cooldown", until: at(65) });
    expect(retakeBlock(past, [], rules, at(65))).toBeNull();
  });

  it("runs the cooldown from the deadline for a Timed out Attempt", () => {
    expect(retakeBlock([timedOut(0)], [], rules, at(30))).toEqual({
      reason: "cooldown",
      until: at(70),
    });
    expect(retakeBlock([timedOut(0)], [], rules, at(70))).toBeNull();
  });

  it("has no wait with a cooldown of 0", () => {
    expect(retakeBlock([submitted(0, 5)], [], { ...rules, cooldown: 0 }, at(5))).toBeNull();
  });

  it("refuses once every Attempt is used, Timed out ones included", () => {
    expect(retakeBlock([submitted(0, 5), timedOut(100)], [], rules, at(10_000))).toEqual({
      reason: "used",
    });
  });

  it("refuses a Learner holding a Valid Certificate, even with Attempts left", () => {
    const held = cert({ expiresAt: at(1000) });
    expect(retakeBlock([submitted(0, 5)], [held], { ...rules, maxAttempts: 5 }, at(500))).toEqual({
      reason: "certificate",
      publicId: "P",
      expiresAt: at(1000),
    });
  });

  it("starts the count again once the Certificate expires, from Attempts started at or after it", () => {
    const past = [submitted(0, 5), submitted(100, 105)];
    const expired = cert({ expiresAt: at(1000) });
    expect(retakeBlock(past, [expired], rules, at(999))).toMatchObject({ reason: "certificate" });
    expect(retakeBlock(past, [expired], rules, at(1000))).toBeNull();
    // Attempts at or after the Expiry count.
    const renewing = [...past, submitted(1000, 1005), timedOut(1100)];
    expect(retakeBlock(renewing, [expired], rules, at(2000))).toEqual({ reason: "used" });
  });

  it("doesn't reset the count on Revocation, even past the revoked Certificate's Expiry", () => {
    const past = [submitted(0, 5), submitted(100, 105)];
    const revoked = cert({ status: "revoked", statusAt: at(200), expiresAt: at(1000) });
    expect(retakeBlock(past, [revoked], rules, at(300))).toEqual({ reason: "used" });
    expect(retakeBlock(past, [revoked], rules, at(2000))).toEqual({ reason: "used" });
  });

  it("lets a Learner whose Certificate was revoked retake if Attempts remain", () => {
    const revoked = cert({ status: "revoked", statusAt: at(200) });
    expect(retakeBlock([submitted(0, 5)], [revoked], rules, at(300))).toBeNull();
  });
});
