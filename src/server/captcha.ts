import { createHmac } from "node:crypto";
import { CappedMap, createChallenge, randomInt, verifySolution, type Challenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/sha";
import { captchaDifficulty } from "./env";

type Env = Record<string, string | undefined>;

const ALGORITHM = "SHA-256";
const MINUTES = 10;

// ponytail: in process memory, like the write queue (ADR 0005, 0007). Past this many solves the
// oldest are forgotten, but by then they're long expired.
const spent = new CappedMap<string, boolean>({ maxSize: 100_000 });

/** Both signing keys come from BETTER_AUTH_SECRET, so the CAPTCHA needs no config of its own. */
function secrets(env: Env) {
  const key = (label: string) =>
    createHmac("sha256", env.BETTER_AUTH_SECRET ?? "")
      .update(`quizz-captcha-${label}`)
      .digest("hex");
  return { hmacSignatureSecret: key("signature"), hmacKeySignatureSecret: key("key") };
}

/** A signed challenge for the browser to solve before it asks for an email. */
export function newCaptcha(now = new Date(), env: Env = process.env): Promise<Challenge> {
  const max = captchaDifficulty(env);
  return createChallenge({
    algorithm: ALGORITHM,
    cost: 1,
    counter: randomInt(max, Math.floor(max / 2)),
    deriveKey,
    expiresAt: new Date(now.getTime() + MINUTES * 60_000),
    ...secrets(env),
  });
}

/** True only for a solution to a challenge this server signed, not expired and not used before.
 * `payload` comes from the browser: base64 of `{ challenge, solution }`. */
export async function captchaPassed(payload: unknown, env: Env = process.env): Promise<boolean> {
  if (typeof payload !== "string" || !payload || payload.length > 4096) return false;
  try {
    const { challenge, solution } = JSON.parse(Buffer.from(payload, "base64").toString());
    if (!challenge?.parameters || !solution) return false;
    const result = await verifySolution({ challenge, solution, deriveKey, ...secrets(env) });
    return result.verified && spent.setIfAbsent(String(challenge.parameters.nonce), true);
  } catch {
    return false;
  }
}
