/**
 * `#>` label lines — the pretitle spelling.
 *
 * On the wire a label is an ordinary heading with `role: "pretitle"`. The
 * hash count is accepted 1–6 and carried in `level` for round-trip fidelity
 * only; it has no meaning. Out-of-bounds or empty spellings stay paragraphs —
 * markdown has no invalid positions.
 */
import { markdownToProseMirror } from "../src/index.js";

const firstNode = (md) => markdownToProseMirror(md).content[0];

describe("pretitle label lines", () => {
    test("#> produces a heading with role pretitle", () => {
        expect(firstNode("#> New in v2")).toEqual({
            type: "heading",
            attrs: { level: 1, id: null, role: "pretitle" },
            content: [{ type: "text", text: "New in v2" }],
        });
    });

    test("the hash count is accepted and carried, not interpreted", () => {
        expect(firstNode("##> New in v2").attrs).toEqual({
            level: 2,
            id: null,
            role: "pretitle",
        });
        expect(firstNode("######> Deep label").attrs.role).toBe("pretitle");
    });

    test("no space after > is accepted — the reflex near-miss must not degrade", () => {
        const node = firstNode("#>New in v2");
        expect(node.type).toBe("heading");
        expect(node.attrs.role).toBe("pretitle");
        expect(node.content).toEqual([{ type: "text", text: "New in v2" }]);
    });

    test("inline marks survive inside a label", () => {
        const node = firstNode("#> New in *v2*");
        expect(node.attrs.role).toBe("pretitle");
        expect(node.content).toEqual([
            { type: "text", text: "New in " },
            { type: "text", text: "v2", marks: [{ type: "italic" }] },
        ]);
    });

    test("a label above a heading stays two separate nodes", () => {
        const doc = markdownToProseMirror("#> New in v2\n\n# Build the system");
        expect(doc.content.map((n) => [n.type, n.attrs?.role ?? null])).toEqual([
            ["heading", "pretitle"],
            ["heading", null],
        ]);
    });

    test("seven hashes fall through to a paragraph, mirroring the heading bound", () => {
        expect(firstNode("#######> Not a label").type).toBe("paragraph");
    });

    test("a bare #> with no text stays a paragraph — nothing to label with", () => {
        expect(firstNode("#>").type).toBe("paragraph");
    });

    test("ordinary headings gain no role attribute", () => {
        expect(firstNode("# Plain heading").attrs).toEqual({
            level: 1,
            id: null,
        });
    });
});
