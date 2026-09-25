import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, parseAccess, parseRules } from "./settings";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const rules = {
  passingScore: "70",
  timeLimit: "10",
  drawn: "5",
  maxAttempts: "2",
  cooldown: "0",
  expiryDays: "",
};

describe("parseRules", () => {
  it("reads whole numbers, with Expiry off when empty", () => {
    expect(parseRules(form(rules))).toEqual({
      passingScore: 70,
      timeLimit: 10,
      drawn: 5,
      maxAttempts: 2,
      cooldown: 0,
      expiryDays: null,
    });
    expect(parseRules(form({ ...rules, expiryDays: "365" }))?.expiryDays).toBe(365);
  });

  it("defaults to Expiry off", () => {
    expect(DEFAULT_RULES.expiryDays).toBeNull();
  });

  it.each([
    ["passingScore", "0"],
    ["passingScore", "101"],
    ["passingScore", "70.5"],
    ["timeLimit", "0"],
    ["drawn", "0"],
    ["maxAttempts", "0"],
    ["cooldown", "-1"],
    ["expiryDays", "0"],
    ["drawn", "abc"],
    ["drawn", ""],
  ])("rejects %s = %j", (field, value) => {
    expect(parseRules(form({ ...rules, [field]: value }))).toBeNull();
  });
});

describe("parseAccess", () => {
  it("reads a known language and Access Mode", () => {
    expect(parseAccess(form({ language: "pt-BR", accessMode: "invite" }))).toEqual({
      language: "pt-BR",
      accessMode: "invite",
    });
  });

  it("rejects anything else", () => {
    expect(parseAccess(form({ language: "fr", accessMode: "public" }))).toBeNull();
    expect(parseAccess(form({ language: "en", accessMode: "secret" }))).toBeNull();
  });
});
