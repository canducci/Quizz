type Env = Record<string, string | undefined>;

const REQUIRED_SECRETS = ["BETTER_AUTH_SECRET", "EMAIL_HMAC_SECRET"];

/** Why the app can't start, or null when every required secret is set. */
export function secretsProblem(env: Env = process.env): string | null {
  const missing = REQUIRED_SECRETS.filter((name) => !env[name]?.trim());
  if (missing.length === 0) return null;
  return [
    `Quizz can't start: ${missing.join(" and ")} must be set in .env.`,
    "Generate each one with:",
    "",
    "  openssl rand -base64 32",
  ].join("\n");
}

/** Google sign-in shows only once a real client id replaces the placeholder. */
export function googleEnabled(env: Env = process.env): boolean {
  const id = env.GOOGLE_CLIENT_ID?.trim();
  return !!id && id !== "placeholder";
}

/** How much work a CAPTCHA solve takes (ADR 0007): the highest counter a browser may have to try.
 * The default solves in about a second on a phone. */
export const CAPTCHA_DIFFICULTY_DEFAULT = 50_000;
const CAPTCHA_DIFFICULTY_RANGE = [1_000, 10_000_000] as const;

export function captchaDifficulty(env: Env = process.env): number {
  const set = env.CAPTCHA_DIFFICULTY?.trim();
  return set ? Number(set) : CAPTCHA_DIFFICULTY_DEFAULT;
}

/** Why CAPTCHA_DIFFICULTY can't be used, or null when it's unset or a whole number in range. */
export function captchaProblem(env: Env = process.env): string | null {
  const n = captchaDifficulty(env);
  const [min, max] = CAPTCHA_DIFFICULTY_RANGE;
  if (Number.isInteger(n) && n >= min && n <= max) return null;
  return `Quizz can't start: CAPTCHA_DIFFICULTY must be a whole number from ${min} to ${max}, or unset.`;
}
