import { markdownToProseMirror, inlineMarkdownToProseMirror } from "../src/index.js";

/**
 * One element's words, read as inline markdown and never as blocks.
 *
 * A value that stands for a heading's or a paragraph's words — a translation of
 * one — was read as a document by its callers, so a value that began like a
 * block became one: `1. Informations que nous collectons`, the French of a
 * numbered heading, was an ordered list, and the heading was handed a list item.
 */

const text = (nodes) => nodes.map((n) => (n.type === "text" ? n.text : `[${n.type}]`)).join("");

describe("a value that begins like a block is its words", () => {
  test.each([
    "1. Informations que nous collectons",
    "2) Second",
    "- Draft",
    "* Starred",
    "+ Plus",
    "> Quoted",
    "# Not a heading",
    "---",
    "```js",
    "| a | b |",
    "[Note]: /x",
  ])("%s", (value) => {
    expect(inlineMarkdownToProseMirror(value)).toEqual([{ type: "text", text: value }]);
  });

  test("a line that would underline a heading stays words", () => {
    expect(text(inlineMarkdownToProseMirror("Title\n==="))).toBe("Title ===");
  });

  // CONTROL: the same values, read as a document, are blocks — what the
  // callers that read a translation as one were handed.
  test("read as a document, the same values are blocks", () => {
    expect(markdownToProseMirror("1. Informations").content[0].type).toBe("orderedList");
    expect(markdownToProseMirror("- Draft").content[0].type).toBe("bulletList");
    expect(markdownToProseMirror("> Quoted").content[0].type).toBe("blockquote");
  });
});

describe("the words read as a paragraph's do", () => {
  test.each([
    "Plain words",
    "**bold** and *italic*",
    "[Go](/x){button variant=primary}",
    "![](lu-house) Home",
    "A [span]{.hl} here",
    "Code `x<y`",
    "Math $x^2$",
    "one\ntwo",
    "a<br>b",
    "R&amp;D &copy;",
    "![alt](./a.jpg) caption",
    "[Read](@Card){k=v}",
    "x [@smith2020] y",
    "see [#fig-1]",
  ])("%s", (value) => {
    expect(inlineMarkdownToProseMirror(value)).toEqual(markdownToProseMirror(value).content[0].content);
  });

  test("a plain newline is a space, and a written break a hard break", () => {
    expect(inlineMarkdownToProseMirror("one\r\ntwo")).toEqual([{ type: "text", text: "one two" }]);
    expect(inlineMarkdownToProseMirror("a  \nb")).toEqual([
      { type: "text", text: "a" },
      { type: "hardBreak" },
      { type: "text", text: "b" },
    ]);
  });

  test("HTML is text, and the caller is told", () => {
    const warnings = [];
    const nodes = inlineMarkdownToProseMirror("<b>x</b>", { onWarning: (m) => warnings.push(m) });
    expect(text(nodes)).toBe("<b>x</b>");
    expect(warnings.length).toBeGreaterThan(0);
  });

  test("an empty value is no nodes", () => {
    expect(inlineMarkdownToProseMirror("")).toEqual([]);
    expect(inlineMarkdownToProseMirror(undefined)).toEqual([]);
  });
});
