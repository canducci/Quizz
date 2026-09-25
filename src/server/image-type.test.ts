import { expect, it } from "vitest";
import { imageType } from "./image-type";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10];
const bytes = async (file: File) => new Uint8Array(await file.arrayBuffer());

it("accepts PNG and JPEG by content", () => {
  expect(imageType(new Uint8Array(PNG))).toBe("image/png");
  expect(imageType(new Uint8Array(JPEG))).toBe("image/jpeg");
});

it("accepts a PNG renamed .txt", async () => {
  const file = new File([new Uint8Array(PNG)], "logo.txt", { type: "text/plain" });
  expect(imageType(await bytes(file))).toBe("image/png");
});

it("rejects SVG and WebP", async () => {
  const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], "logo.png", {
    type: "image/png",
  });
  const webp = new File(["RIFF\0\0\0\0WEBPVP8 "], "logo.png", { type: "image/png" });
  expect(imageType(await bytes(svg))).toBeNull();
  expect(imageType(await bytes(webp))).toBeNull();
  expect(imageType(new Uint8Array())).toBeNull();
});
