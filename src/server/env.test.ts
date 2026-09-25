import { describe, expect, it } from "vitest";
import { googleEnabled, secretsProblem } from "./env";

describe("secretsProblem", () => {
  it("passes when both secrets are set", () => {
    expect(secretsProblem({ BETTER_AUTH_SECRET: "a", EMAIL_HMAC_SECRET: "b" })).toBeNull();
  });

  it("names each missing or blank secret and how to make one", () => {
    const message = secretsProblem({ BETTER_AUTH_SECRET: "  " });
    expect(message).toContain("BETTER_AUTH_SECRET");
    expect(message).toContain("EMAIL_HMAC_SECRET");
    expect(message).toContain("openssl rand -base64 32");
  });
});

describe("googleEnabled", () => {
  it("is off when the client id is missing, blank or the placeholder", () => {
    expect(googleEnabled({})).toBe(false);
    expect(googleEnabled({ GOOGLE_CLIENT_ID: " " })).toBe(false);
    expect(googleEnabled({ GOOGLE_CLIENT_ID: "placeholder" })).toBe(false);
  });

  it("is on for a real client id", () => {
    expect(googleEnabled({ GOOGLE_CLIENT_ID: "123-abc.apps.googleusercontent.com" })).toBe(true);
  });
});
