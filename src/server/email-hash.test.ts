import { describe, expect, it } from "vitest";
import { emailHash, normalizeEmail, parseEmailList } from "./email-hash";

describe("email hash", () => {
  it("normalises by trimming and lowercasing only", () => {
    expect(normalizeEmail("  Ana.B+x@Example.TEST \n")).toBe("ana.b+x@example.test");
  });

  it("is HMAC-SHA256 hex of the normalised email", () => {
    // Pinned: changing normalisation would orphan every stored hash.
    expect(emailHash("  Ana@Example.TEST ", "secret")).toBe(
      "294d99e5d06b49b7fc6588c280cf2ad31ea7a3914357fda7e2998d9893372abf",
    );
    expect(emailHash("ana@example.test", "secret")).toBe(emailHash("ANA@example.test", "secret"));
    expect(emailHash("ana@example.test", "other")).not.toBe(
      emailHash("ana@example.test", "secret"),
    );
  });
});

describe("parseEmailList", () => {
  it("splits on whitespace, commas and semicolons, dedupes and counts what isn't an email", () => {
    expect(parseEmailList("a@x.test, B@x.test;\n\nb@x.test  nope\tc@x")).toEqual({
      emails: ["a@x.test", "b@x.test"],
      invalid: 2,
    });
  });

  it("unwraps emails pasted from a mail client or a sentence", () => {
    expect(parseEmailList('Ana <ana@x.test>, "bo@x.test". (cy@x.test)').emails).toEqual([
      "ana@x.test",
      "bo@x.test",
      "cy@x.test",
    ]);
  });
});
