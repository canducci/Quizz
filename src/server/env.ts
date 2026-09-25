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
