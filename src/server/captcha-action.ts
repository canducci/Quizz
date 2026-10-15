"use server";

import { newCaptcha } from "./captcha";

/** A fresh CAPTCHA challenge for a public form; see `solveCaptcha`. */
export async function captchaChallenge() {
  return newCaptcha();
}
