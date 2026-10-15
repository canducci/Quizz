/** The request header that carries a solved CAPTCHA to Better Auth's magic-link endpoint (ADR 0007).
 * Shared with the UI, which can't import the server module. */
export const CAPTCHA_HEADER = "x-captcha";

/** The error code Better Auth returns when that header is missing or doesn't verify. */
export const CAPTCHA_FAILED = "CAPTCHA_FAILED";
