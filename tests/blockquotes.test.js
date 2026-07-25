import { markdownToProseMirror } from "../src/index.js";

describe("Blockquotes", () => {
  test("drops tokens that carry no node instead of leaving holes", () => {
    // The blank `>` line between the paragraph and the fence is a `space`
    // token, which has no node of its own. It used to survive as a literal
    // null in the blockquote's content array — every downstream reader then
    // walked onto it, and the first to touch node.attrs threw.
    const markdown = [
      "> **Recipe:** run it with one command:",
      ">",
      "> ```bash",
      "> uniweb add ci",
      "> ```",
      ">",
      "> That is the whole flow.",
    ].join("\n");

    const result = markdownToProseMirror(markdown);
    const quote = result.content[0];

    expect(quote.type).toBe("blockquote");
    expect(quote.content).not.toContain(null);
    expect(quote.content.every(Boolean)).toBe(true);
    expect(quote.content.map((node) => node.type)).toEqual([
      "paragraph",
      "codeBlock",
      "paragraph",
    ]);
  });

  test("keeps nested block content in order", () => {
    const markdown = ["> First.", ">", "> - one", "> - two"].join("\n");

    const quote = markdownToProseMirror(markdown).content[0];

    expect(quote.content.every(Boolean)).toBe(true);
    expect(quote.content.map((node) => node.type)).toEqual([
      "paragraph",
      "bulletList",
    ]);
  });
});
