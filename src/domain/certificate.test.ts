import { expect, it } from "vitest";
import { NAME_BOX, expiryOf, formatId, nameSize, newPublicId } from "./certificate";

it("makes 16-character Crockford base32 ids", () => {
  const ids = Array.from({ length: 200 }, () => newPublicId());
  for (const id of ids) expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/);
  expect(new Set(ids).size).toBe(ids.length);
  // Every one of the 32 symbols turns up; none of I, L, O, U ever does.
  expect(new Set(ids.join("")).size).toBe(32);
});

it("maps each byte's low five bits to one symbol", () => {
  const bytes = Buffer.from([0, 1, 9, 10, 17, 18, 20, 21, 26, 27, 31, 32, 63, 255, 224, 100]);
  expect(newPublicId(() => bytes)).toBe("019AHJMNTVZ0ZZ04");
});

it("shows the id in groups of four", () => {
  expect(formatId("7K2P9QZ9X2LKQ4M8")).toBe("7K2P-9QZ9-X2LK-Q4M8");
});

it("expires the given number of days after issue, or never", () => {
  const issued = new Date(Date.UTC(2026, 8, 25, 12));
  expect(expiryOf(issued, 365)).toEqual(new Date(Date.UTC(2027, 8, 25, 12)));
  expect(expiryOf(issued, null)).toBeNull();
});

// `ems` is the name's width at 1pt: about half its length for ordinary letters, near all of it in Ws.
it("keeps the showcase's size steps for names that fit", () => {
  expect(nameSize("Ana Souza", 4.2)).toBe(42);
  expect(nameSize("x".repeat(26), 13)).toBe(42);
  expect(nameSize("x".repeat(27), 13.5)).toBeCloseTo(33.6);
  const maria = "Maria Eduarda dos Santos Albuquerque Figueiredo de Oliveira";
  expect(nameSize(maria, 27)).toBeCloseTo(26.04);
});

it("shrinks further until the wrapped name fits its box", () => {
  const fits = (ems: number, size: number) =>
    Math.ceil((ems * size) / NAME_BOX.width) * size * 1.1 <= NAME_BOX.height;
  for (const ems of [60, 90, 185]) {
    const size = nameSize("x".repeat(41), ems);
    expect(size).toBeLessThan(26.04);
    expect(fits(ems, size)).toBe(true);
    expect(fits(ems, size / 0.95)).toBe(false);
  }
  expect(nameSize("x".repeat(200), 185)).toBeLessThan(nameSize("x".repeat(200), 90));
});
