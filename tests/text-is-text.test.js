import { markdownToProseMirror } from "../src/index.js";

/**
 * A text node holds the characters a reader sees.
 *
 * Until 2026-10-14 a text node held HTML: a code span's `<` was stored as
 * `&lt;`, raw HTML an author wrote stayed markup, and the renderer pasted text
 * in as stored — so an inline `<img src=x onerror=…>` ran on a published page.
 * Now every value is decoded once on its way into a node, and HTML is not
 * content: a tag stays the text it is, and shows as written, except `<br>`.
 */

/** The first block's inline nodes. */
const inline = (markdown, options) => markdownToProseMirror(markdown, options).content[0].content;
/** The first block's text, joined. */
const text = (markdown) =>
  inline(markdown)
    .map((n) => (n.type === "text" ? n.text : `[${n.type}]`))
    .join("");

describe("characters, decoded once", () => {
  test("a comparison is the text it is", () => {
    expect(text("if a<b then swap")).toBe("if a<b then swap");
  });

  test("a code span holds its characters, not their escapes", () => {
    const [, code] = inline("Use the `<div>` element.");
    expect(code).toEqual({ type: "text", marks: [{ type: "code" }], text: "<div>" });
    expect(text("`&lt;` is an entity")).toBe("&lt; is an entity");
  });

  test("a reference names a character", () => {
    expect(text("&lt;div&gt; &copy; &hearts; &#60; &#x3c;")).toBe("<div> © ♥ < <");
  });

  test("an escaped character is the character", () => {
    expect(text("Use the \\<div> element.")).toBe("Use the <div> element.");
  });

  test("a reference counts only with its semicolon, as in CommonMark", () => {
    expect(text("R&D and &notes and AT&T")).toBe("R&D and &notes and AT&T");
  });

  test("a link title and an image's alt are decoded too", () => {
    const [link] = inline('[x](/a "Tom &amp; Jerry")');
    expect(link.marks[0].attrs.title).toBe("Tom & Jerry");
    // An image alone in its paragraph is hoisted to the document root.
    const image = markdownToProseMirror("![a &lt; b](/i.png)").content[0];
    expect(image.attrs.alt).toBe("a < b");
  });
});

describe("HTML is not content", () => {
  test("<br> is the one tag kept, as a hard break — in a heading too", () => {
    const heading = markdownToProseMirror("# Launch a platform<br/>that's yours").content[0];
    expect(heading.type).toBe("heading");
    expect(heading.content.map((n) => n.text ?? `[${n.type}]`)).toEqual([
      "Launch a platform",
      "[hardBreak]",
      "that's yours",
    ]);
    expect(text("a<br>b<BR />c")).toBe("a[hardBreak]b[hardBreak]c");
  });

  test("any other tag shows as written, and the parse says so", () => {
    const warnings = [];
    const nodes = inline("a <strong>bold</strong> b <img src=x onerror=alert(1)>", {
      onWarning: (m) => warnings.push(m),
    });
    expect(nodes.map((n) => n.text).join("")).toBe("a <strong>bold</strong> b <img src=x onerror=alert(1)>");
    expect(nodes.every((n) => n.type === "text" && !n.marks)).toBe(true);
    expect(warnings).toEqual([
      "HTML is not content, so `<strong>` shows as written",
      "HTML is not content, so `</strong>` shows as written",
      "HTML is not content, so `<img src=x onerror=alert(1)>` shows as written",
    ]);
  });

  test("a block of HTML shows as written instead of vanishing", () => {
    const warnings = [];
    const doc = markdownToProseMirror('<div onclick="x">block</div>\n\nAfter.', {
      onWarning: (m) => warnings.push(m),
    });
    expect(doc.content[0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: '<div onclick="x">block</div>' }],
    });
    expect(warnings).toEqual(['HTML is not content, so this block shows as written: `<div onclick="x">block</div>`']);
  });

  test("a comment is dropped, and so is a <br> between blocks — without a word", () => {
    const warnings = [];
    const doc = markdownToProseMirror("<!-- a note -->\n\nOne.\n\n<br>\n\nTwo.", {
      onWarning: (m) => warnings.push(m),
    });
    expect(doc.content.map((b) => b.content[0].text)).toEqual(["One.", "Two."]);
    expect(warnings).toEqual([]);
  });

  test("each notice is reported once, and nothing is reported to nobody", () => {
    const warnings = [];
    markdownToProseMirror("<b>a</b> <b>c</b>", { onWarning: (m) => warnings.push(m) });
    expect(warnings).toEqual([
      "HTML is not content, so `<b>` shows as written",
      "HTML is not content, so `</b>` shows as written",
    ]);
    expect(() => markdownToProseMirror("<b>x</b>")).not.toThrow();
  });
});
