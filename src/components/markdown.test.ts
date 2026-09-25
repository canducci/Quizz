import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Markdown } from "./markdown";

const html = (source: string) => renderToStaticMarkup(createElement(Markdown, { source }));
const KEY = "0190a4c2-1234-7abc-8def-0123456789ab";

it("strips scripts and raw HTML", () => {
  const out = html('Hi <script>alert(1)</script> <b onclick="x()">bold</b> <img src="/x.png">');
  expect(out).not.toMatch(/<script|<b|onclick|<img/);
  expect(html("[click](javascript:alert(1))")).not.toContain("javascript:");
});

it("shows only images uploaded to Quizz", () => {
  expect(html(`![ok](/files/${KEY})`)).toContain(`src="/files/${KEY}"`);
  for (const src of [
    "https://evil.test/x.png",
    "//evil.test/x.png",
    "/\\evil.test/x.png",
    "data:image/png;base64,AAAA",
    `/files/${KEY}/../../x.png`,
    `/files/${KEY}?x=1`,
  ]) {
    expect(html(`![a](${src})`), src).not.toMatch(/src=/);
  }
  expect(html("![a][r]\n\n[r]: https://evil.test/x.png")).not.toMatch(/src=/);
});

it("renders GFM and highlights code", () => {
  expect(html("~~gone~~")).toContain("<del>");
  expect(html("```js\nconst a = 1;\n```")).toContain('class="hljs-keyword"');
});
