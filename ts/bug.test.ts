import { expect, test } from "bun:test";
import { transformerTwoslash } from "@shikijs/twoslash";
import { toText } from "hast-util-to-text";
import { codeToHast } from "shiki";
import { twoslashBugWorkaround } from "./index.js";

const code = `"code (line 1)";
// @log: a tag (line 2)
"code (line 3)";
// @log: a tag (line 4)
"code (line 5)";
// @log: a tag (line 6)
"code (line 7)";
// @log: a tag (line 8)`;

test("reproduce the bug", async () => {
  const transformer = transformerTwoslash();
  const hast = await codeToHast(code, {
    lang: "ts",
    theme: "min-dark",
    transformers: [transformer],
  });
  const text = toText(hast);
  expect(text).toMatchInlineSnapshot(`
    ""code (line 1)";
    "code (line 3)";
    a tag (line 2)
    "code (line 5)";
    a tag (line 4)
    "code (line 7)";
    a tag (line 6)
    a tag (line 8)"
  `);
  await writePreviewHtml("./out/bug.html", hast);
});

test("workaround the bug", async () => {
  const transformer = transformerTwoslash();
  // Add a workaround to fix the bug:
  const fixedTransformer = twoslashBugWorkaround(transformer);
  const hast = await codeToHast(code, {
    lang: "ts",
    theme: "min-dark",
    transformers: [fixedTransformer],
  });
  const text = toText(hast);
  expect(text).toMatchInlineSnapshot(`
    ""code (line 1)";
    a tag (line 2)
    "code (line 3)";
    a tag (line 4)
    "code (line 5)";
    a tag (line 6)
    "code (line 7)";
    a tag (line 8)"
  `);
  await writePreviewHtml("./out/workaround.html", hast);
});

async function writePreviewHtml(
  filename: string,
  hast: Awaited<ReturnType<typeof codeToHast>>,
) {
  const styleTags = `<link rel="stylesheet" href="../node_modules/@shikijs/twoslash/style-rich.css" />
<style>
html, body { margin: 0; }
.shiki { padding: 2em; }
</style>`;
  const { hastToHtml } = await import("shiki");
  const html = hastToHtml(hast);
  await Bun.write(filename, `${styleTags}${html}`);
}
