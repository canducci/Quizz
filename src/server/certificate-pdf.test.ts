import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { MAX_NAME } from "../domain/attempt";
import { MAX_BRAND_TEXT, type Snapshot } from "../domain/publish";
import { certificatePdf } from "./certificate-pdf";

const png = (name: string) =>
  `data:image/png;base64,${readFileSync(`e2e/fixtures/${name}.png`).toString("base64")}`;
const images = { logo: png("logo"), signature: png("signature") };
const pages = (pdf: Buffer) => pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length;

const snapshot = (title: string, name: string): Snapshot => ({
  title,
  settings: {
    language: "pt-BR",
    accessMode: "public",
    passingScore: 70,
    timeLimit: 30,
    drawn: 10,
    maxAttempts: 3,
    cooldown: 0,
    expiryDays: 365,
  },
  questions: [],
  branding: {
    name,
    logoKey: null,
    accentColour: "#7c3aed",
    signerName: "João ".repeat(20).slice(0, MAX_BRAND_TEXT),
    signerTitle: "Coordenador ".repeat(9).slice(0, MAX_BRAND_TEXT),
    signatureKey: null,
  },
});

// W is the widest letter; each length is the longest (or shortest) at its name size.
it.each([26, 27, 40, 41, 100, 101, MAX_NAME])(
  "fits a %i-letter name beside the longest title, Creator and signer on one page",
  async (letters) => {
    const pdf = await certificatePdf(
      {
        publicId: "7K2P9QZ9X2LKQ4M8",
        holderName: "W".repeat(letters),
        score: 71,
        issuedAt: new Date(Date.UTC(2026, 8, 20)),
        expiresAt: new Date(Date.UTC(2027, 8, 20)),
      },
      snapshot(
        "Microsserviços ".repeat(14).slice(0, 200),
        "Instituto ".repeat(10).slice(0, MAX_BRAND_TEXT),
      ),
      images,
      "https://quizz.example.com",
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pages(pdf)).toBe(1);
  },
);
