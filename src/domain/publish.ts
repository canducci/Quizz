import type { Locale } from "../i18n/locales";
import { questionProblems, type QuestionContent } from "./question";
import { RANGES, type AccessMode, type Rules } from "./settings";

export const DEFAULT_ACCENT = "#1f6feb";

type Assessment = Rules & { title: string; language: Locale; accessMode: AccessMode };
type PoolQuestion = QuestionContent & { id: string };
export type Branding = {
  name: string;
  logoKey: string | null;
  accentColour: string | null;
  signerName: string | null;
  signerTitle: string | null;
  signatureKey: string | null;
};

/** What an Assessment Version freezes: Certificates render from it forever. */
export type Snapshot = {
  title: string;
  settings: Rules & { language: Locale; accessMode: AccessMode };
  questions: PoolQuestion[];
  branding: Branding;
};

export type PublishProblem =
  | { code: "poolTooSmall"; pool: number; drawn: number }
  | { code: "incompleteQuestion"; n: number }
  | { code: "noPassingScore" | "noTimeLimit" }
  | { code: "noBranding"; missing: ("logo" | "signerName" | "signature")[] };

const inRange = (n: number, [min, max]: readonly [number, number]) => n >= min && n <= max;
const REQUIRED_BRANDING = [
  ["logoKey", "logo"],
  ["signerName", "signerName"],
  ["signatureKey", "signature"],
] as const;

/** What stops an Assessment from being published. Codes, so the UI can word them. */
export function publishProblems(a: Assessment, pool: QuestionContent[], creator: Branding) {
  const problems: PublishProblem[] = [];
  if (pool.length < a.drawn)
    problems.push({ code: "poolTooSmall", pool: pool.length, drawn: a.drawn });
  pool.forEach((q, i) => {
    if (questionProblems(q).length) problems.push({ code: "incompleteQuestion", n: i + 1 });
  });
  if (!inRange(a.passingScore, RANGES.passingScore)) problems.push({ code: "noPassingScore" });
  if (!inRange(a.timeLimit, RANGES.timeLimit)) problems.push({ code: "noTimeLimit" });
  const missing = REQUIRED_BRANDING.filter(([f]) => !creator[f]?.trim()).map(([, name]) => name);
  if (missing.length) problems.push({ code: "noBranding", missing });
  return problems;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export function snapshotOf(a: Assessment, pool: PoolQuestion[], creator: Branding): Snapshot {
  const snapshot: Snapshot = {
    title: a.title,
    settings: {
      language: a.language,
      accessMode: a.accessMode,
      passingScore: a.passingScore,
      timeLimit: a.timeLimit,
      drawn: a.drawn,
      maxAttempts: a.maxAttempts,
      cooldown: a.cooldown,
      expiryDays: a.expiryDays,
    },
    questions: pool.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      options: q.options.map((o) => ({ text: o.text, correct: o.correct })),
      keepOrder: q.keepOrder,
    })),
    branding: {
      name: creator.name,
      logoKey: creator.logoKey,
      accentColour: creator.accentColour ?? DEFAULT_ACCENT,
      signerName: creator.signerName,
      signerTitle: creator.signerTitle,
      signatureKey: creator.signatureKey,
    },
  };
  return deepFreeze(snapshot);
}
