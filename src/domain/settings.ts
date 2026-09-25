import { locales, type Locale } from "../i18n/locales";

export const ACCESS_MODES = ["public", "invite"] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

/** Each rule's allowed whole-number range; Expiry (days) may also be off (null). */
export const RANGES = {
  passingScore: [1, 100],
  timeLimit: [1, 24 * 60], // minutes
  drawn: [1, 1000],
  maxAttempts: [1, 100],
  cooldown: [0, 365 * 24 * 60], // minutes
  expiryDays: [1, 3650],
} as const;

export type Rules = Record<Exclude<keyof typeof RANGES, "expiryDays">, number> & {
  expiryDays: number | null;
};

export const DEFAULT_RULES: Rules = {
  passingScore: 70,
  timeLimit: 10,
  drawn: 5,
  maxAttempts: 2,
  cooldown: 60,
  expiryDays: null,
};

/** The Rules tab's fields, or null if any is out of range. */
export function parseRules(form: FormData): Rules | null {
  const rules: Record<string, number | null> = {};
  for (const [field, [min, max]] of Object.entries(RANGES)) {
    const raw = String(form.get(field) ?? "").trim();
    if (field === "expiryDays" && !raw) {
      rules[field] = null;
      continue;
    }
    const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!(n >= min && n <= max)) return null;
    rules[field] = n;
  }
  return rules as Rules;
}

/** The Access & language tab's fields, or null if unknown. */
export function parseAccess(form: FormData): { language: Locale; accessMode: AccessMode } | null {
  const language = locales.find((l) => l === form.get("language"));
  const accessMode = ACCESS_MODES.find((m) => m === form.get("accessMode"));
  return language && accessMode ? { language, accessMode } : null;
}
