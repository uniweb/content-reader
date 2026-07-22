import { markdownToProseMirror } from "../src/index.js";

/**
 * A link label is inline content, not a string.
 *
 * The custom link tokenizer — added so links could carry `{k=v}` attributes —
 * returned `tokens: []` unconditionally while declaring `childTokens:
 * ['tokens']`, so a label's own markup was never tokenized. `[*Sense*](/x)`
 * came out as the literal characters `*Sense*` inside the link instead of
 * emphasized text, which is not what CommonMark specifies and not what an
 * author writing ordinary markdown expects.
 */

/** Collect the inline nodes of the first paragraph. */
function inlineOf(md) {
  const doc = markdownToProseMirror(md);
  return doc.content?.[0]?.content ?? [];
}

const markTypes = (node) => (node.marks ?? []).map((m) => m.type).sort();

describe("Link labels", () => {
  it("parses emphasis inside a label", () => {
    const [node] = inlineOf("[*Sense*](/x)");

    expect(node.text).toBe("Sense");
    expect(markTypes(node)).toEqual(["italic", "link"]);
    expect(node.marks.find((m) => m.type === "link").attrs.href).toBe("/x");
  });

  it("parses strong inside a label", () => {
    const [node] = inlineOf("[**Bold**](/x)");

    expect(node.text).toBe("Bold");
    expect(markTypes(node)).toEqual(["bold", "link"]);
  });

  it("keeps a plain label as a single text node", () => {
    const nodes = inlineOf("[plain](/x)");

    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("plain");
    expect(markTypes(nodes[0])).toEqual(["link"]);
  });

  it("handles a label that is partly emphasized", () => {
    const nodes = inlineOf("[read *this* now](/x)");

    expect(nodes.map((n) => n.text)).toEqual(["read ", "this", " now"]);
    // every piece stays linked; only the middle one is italic
    for (const n of nodes) expect(markTypes(n)).toContain("link");
    expect(markTypes(nodes[1])).toContain("italic");
    expect(markTypes(nodes[0])).not.toContain("italic");
  });

  it("still applies emphasis wrapping a link", () => {
    const [node] = inlineOf("*[Outside](/x)*");

    expect(node.text).toBe("Outside");
    expect(markTypes(node)).toEqual(["italic", "link"]);
  });

  it("preserves curly-brace attributes", () => {
    const [node] = inlineOf("[Book a Talk](/talks){role=button}");

    const link = node.marks.find((m) => m.type === "link");
    expect(link.attrs.href).toBe("/talks");
    expect(link.attrs.role).toBe("button");
  });

  it("preserves the button form", () => {
    const [node] = inlineOf("[Go](button:/signup)");

    expect(node.marks.some((m) => m.type === "button")).toBe(true);
  });

  it("leaves @component inset references alone", () => {
    // `[text](@Component)` is an inline inset, not a link — the label is
    // carried as an attribute, so label tokenization must not divert it.
    const [node] = inlineOf("[caption](@Figure){n=1}");

    expect(node.type).toBe("inset_ref");
    expect(node.attrs.component).toBe("Figure");
    expect(node.attrs.embedKind).toBe("text");
  });

  it("leaves keyed @component references alone", () => {
    const [node] = inlineOf("[@darwin1859](@Cite){page=42}");

    expect(node.type).toBe("inset_ref");
    expect(node.attrs.component).toBe("Cite");
    expect(node.attrs.key).toBe("@darwin1859");
  });
});
