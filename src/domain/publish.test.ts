import { describe, expect, it } from "vitest";
import { publishProblems, snapshotOf } from "./publish";
import { DEFAULT_RULES, RANGES } from "./settings";

const good = {
  type: "single" as const,
  text: "Q",
  options: [
    { text: "a", correct: true },
    { text: "b", correct: false },
  ],
  keepOrder: false,
};
const assessment = {
  title: "React",
  language: "en" as const,
  accessMode: "public" as const,
  ...DEFAULT_RULES,
  drawn: 2,
};
const creator = {
  name: "Acme",
  logoKey: "logo",
  accentColour: null,
  signerName: "Ana",
  signerTitle: null,
  signatureKey: "sig",
};
const pool = [
  { id: "q1", ...good },
  { id: "q2", ...good },
];

describe("publishProblems", () => {
  it("finds nothing in a ready Assessment", () => {
    expect(publishProblems(assessment, pool, creator)).toEqual([]);
  });

  it("flags a pool smaller than the Questions per Attempt", () => {
    expect(publishProblems(assessment, pool.slice(1), creator)).toEqual([
      { code: "poolTooSmall", pool: 1, drawn: 2 },
    ]);
  });

  it("flags each incomplete Question by position", () => {
    const bad = { ...pool[1], text: " " };
    expect(publishProblems(assessment, [pool[0], bad], creator)).toEqual([
      { code: "incompleteQuestion", n: 2 },
    ]);
  });

  it("flags a Passing Score or time limit out of range", () => {
    expect(
      publishProblems({ ...assessment, passingScore: 0, timeLimit: 0 }, pool, creator),
    ).toEqual([{ code: "noPassingScore" }, { code: "noTimeLimit" }]);
  });

  it("flags missing branding, naming what is missing", () => {
    expect(
      publishProblems(assessment, pool, { ...creator, logoKey: null, signerName: " " }),
    ).toEqual([{ code: "noBranding", missing: ["logo", "signerName"] }]);
  });
});

describe("snapshotOf", () => {
  const snapshot = snapshotOf(assessment, pool, creator);

  it("keeps every setting, the Questions with their ids and the branding", () => {
    expect(Object.keys(snapshot.settings).sort()).toEqual(
      [...Object.keys(RANGES), "language", "accessMode"].sort(),
    );
    expect(snapshot.title).toBe("React");
    expect(snapshot.questions.map((q) => q.id)).toEqual(["q1", "q2"]);
    expect(snapshot.questions[0]).toEqual({ id: "q1", ...good });
    // The effective accent is frozen, so a new default never changes old Certificates.
    expect(snapshot.branding).toEqual({ ...creator, accentColour: "#1f6feb" });
  });

  it("is a copy the working copy can't reach", () => {
    const working = [{ id: "q1", ...good, options: good.options.map((o) => ({ ...o })) }];
    const frozen = snapshotOf(assessment, working, creator);
    working[0].options[0].text = "changed";
    expect(frozen.questions[0].options[0].text).toBe("a");
    expect(Object.isFrozen(frozen.questions[0].options[0])).toBe(true);
  });
});
