import { solveChallenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/web/sha";
import { captchaChallenge } from "@/server/captcha-action";

/** Fetches a challenge and solves it in the browser (ADR 0007). Nothing to show the person:
 * the form's own pending state covers the second it takes. An empty string if it can't be
 * solved, which the server then refuses. */
export async function solveCaptcha(): Promise<string> {
  try {
    const challenge = await captchaChallenge();
    const solution = await solveChallenge({ challenge, deriveKey });
    return solution ? btoa(JSON.stringify({ challenge, solution })) : "";
  } catch {
    return "";
  }
}
