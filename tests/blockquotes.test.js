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

describe("GitHub alerts — a second spelling of a concept block", () => {
    const first = (md) => markdownToProseMirror(md).content[0];

    test("`> [!WARNING]` becomes a concept block, not a blockquote", () => {
        const node = first("> [!WARNING]\n> Back up your database first.\n");
        expect(node.type).toBe("concept_block");
        expect(node.attrs).toEqual({ tag: "warning", syntax: "gfm" });
        expect(node.content.map((n) => n.type)).toEqual(["paragraph"]);
    });

    test("the marker line is consumed, the body is not", () => {
        const node = first("> [!NOTE]\n> Something **worth** knowing.\n");
        const [para] = node.content;
        const marks = para.content.flatMap((c) => (c.marks || []).map((m) => m.type));
        expect(para.content.map((c) => c.text).join("")).toBe("Something worth knowing.");
        expect(marks).toContain("bold");
    });

    test("all five GitHub kinds, lowercased to a tag", () => {
        for (const kind of ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]) {
            const node = first(`> [!${kind}]\n> Body.\n`);
            expect(node.type).toBe("concept_block");
            expect(node.attrs.tag).toBe(kind.toLowerCase());
        }
    });

    test("an UNKNOWN marker stays an ordinary blockquote", () => {
        // The closed set is what keeps this a convention rather than a
        // registry: an unrecognized marker must not mint a junk tag.
        const node = first("> [!NONSENSE]\n> Body.\n");
        expect(node.type).toBe("blockquote");
    });

    test("a plain blockquote is untouched — the branch is additive", () => {
        expect(first("> Just a quotation.\n").type).toBe("blockquote");
        expect(first("> [not a marker]\n> Body.\n").type).toBe("blockquote");
    });

    test("text on the marker's own line is kept, not discarded", () => {
        const node = first("> [!TIP] Start here.\n> Then continue.\n");
        expect(node.type).toBe("concept_block");
        const text = node.content[0].content.map((c) => c.text).join("");
        expect(text).toContain("Start here.");
        expect(text).toContain("Then continue.");
    });

    test("a marker with no body yields a concept block with no content", () => {
        const node = first("> [!WARNING]\n");
        expect(node.type).toBe("concept_block");
        expect(node.content).toEqual([]);
    });

    test("the fence spelling carries no `syntax`, so the two are distinguishable", () => {
        const fence = first("```md:warning\nBody.\n```");
        expect(fence.attrs).toEqual({ tag: "warning" });
    });

    test("both spellings produce the same tag and the same body", () => {
        const gfm = first("> [!WARNING]\n> Back up **first**.\n");
        const fence = first("```md:warning\nBack up **first**.\n```");
        expect(gfm.attrs.tag).toBe(fence.attrs.tag);
        expect(gfm.content).toEqual(fence.content);
    });
});
