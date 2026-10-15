/**
 * Where a block sits in a flow — an image's, a video's and a table's
 * `placement` — and the caption line a table takes it from.
 *
 *   ![The harbour at dawn](harbour.jpg){placement=wide}
 *
 *   | Plan | Price |
 *   | ---- | ----- |
 *
 *   : Plans and prices {placement=wide #tbl-plans}
 */
import { markdownToProseMirror, PLACEMENTS } from "../src/index.js";

const TABLE = "| Plan | Price |\n| ---- | ----- |\n| Basic | $10 |\n";

/** The document and what the parse said about it. */
function read(markdown) {
  const warnings = [];
  const doc = markdownToProseMirror(markdown, { onWarning: (w) => warnings.push(w) });
  return { doc, warnings };
}

describe("the four words", () => {
  test("are left, right, wide and full — absent is the text column", () => {
    expect(PLACEMENTS).toEqual(["left", "right", "wide", "full"]);
  });
});

describe("an image's and a video's placement", () => {
  test.each(["left", "right", "wide", "full"])("{placement=%s} is kept", (value) => {
    const { doc, warnings } = read(`![Harbour](harbour.jpg){placement=${value}}\n`);
    expect(doc.content[0].attrs.placement).toBe(value);
    expect(warnings).toEqual([]);
  });

  test("a video takes one in the same block", () => {
    const { doc } = read("![](tour.mp4){role=video placement=full}\n");
    expect(doc.content[0].attrs).toMatchObject({ role: "video", placement: "full" });
  });

  test("an image without one has none — the text column is the default, not a value", () => {
    const { doc } = read("![Harbour](harbour.jpg)\n");
    expect(doc.content[0].attrs).not.toHaveProperty("placement");
  });

  test("any other value is left out, and the author told where the image sits", () => {
    const { doc, warnings } = read("![Harbour](harbour.jpg){placement=middle}\n");
    expect(doc.content[0].attrs).not.toHaveProperty("placement");
    expect(warnings).toEqual([
      "`{placement=middle}` is not a placement — they are left, right, wide, full — so the image sits in the text column",
    ]);
  });
});

describe("a table's caption line", () => {
  test("gives the table a caption, an id and a placement", () => {
    const { doc, warnings } = read(`${TABLE}\n: Plans and prices {placement=wide #tbl-plans}\n`);
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe("table");
    expect(doc.content[0].attrs).toEqual({ caption: "Plans and prices", id: "tbl-plans", placement: "wide" });
    expect(warnings).toEqual([]);
  });

  test("its block takes the id and the placement in either order", () => {
    const { doc } = read(`${TABLE}\n: Rates {#tbl-rates placement=left}\n`);
    expect(doc.content[0].attrs).toEqual({ caption: "Rates", id: "tbl-rates", placement: "left" });
  });

  test("with no caption it is `: {…}` alone", () => {
    const { doc } = read(`${TABLE}\n: {placement=full}\n`);
    expect(doc.content[0].attrs).toEqual({ placement: "full" });
  });

  test("a caption alone, with no block", () => {
    const { doc } = read(`${TABLE}\n: Plans and prices\n`);
    expect(doc.content[0].attrs).toEqual({ caption: "Plans and prices" });
  });

  test("a table with no caption line has no attributes", () => {
    const { doc } = read(TABLE);
    expect(doc.content[0]).not.toHaveProperty("attrs");
  });

  test("braces holding anything else are caption text — a Loom placeholder stays", () => {
    const { doc } = read(`${TABLE}\n: Revenue by {year}\n`);
    expect(doc.content[0].attrs).toEqual({ caption: "Revenue by {year}" });
  });

  test("a block with a key it does not take is caption text whole", () => {
    const { doc } = read(`${TABLE}\n: Plans {placement=wide class=x}\n`);
    expect(doc.content[0].attrs).toEqual({ caption: "Plans {placement=wide class=x}" });
  });

  test("an escaped brace is the character, and opens no block", () => {
    const { doc } = read(`${TABLE}\n: Literal \\{placement=wide}\n`);
    expect(doc.content[0].attrs).toEqual({ caption: "Literal {placement=wide}" });
  });

  test("a caption is plain text: formatting is left out with a warning, and the words kept", () => {
    const { doc, warnings } = read(`${TABLE}\n: Plans and **prices** &amp; [more](https://x.test)\n`);
    expect(doc.content[0].attrs).toEqual({ caption: "Plans and prices & more" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^A table's caption is plain text/);
  });

  test("a caption over several lines is one line of text", () => {
    const { doc } = read(`${TABLE}\n: Plans and\nprices\n`);
    expect(doc.content[0].attrs).toEqual({ caption: "Plans and prices" });
  });

  test("an unknown placement is left out with a warning; the rest of the line is kept", () => {
    const { doc, warnings } = read(`${TABLE}\n: Plans {placement=banana #tbl-p}\n`);
    expect(doc.content[0].attrs).toEqual({ caption: "Plans", id: "tbl-p" });
    expect(warnings).toEqual([
      "`{placement=banana}` is not a placement — they are left, right, wide, full — so the table sits in the text column",
    ]);
  });

  test("it reads in a blockquote, as at the top level", () => {
    const { doc } = read("> | a |\n> |---|\n> | 1 |\n>\n> : In a quote {#tbl-q}\n");
    expect(doc.content[0].type).toBe("blockquote");
    expect(doc.content[0].content).toHaveLength(1);
    expect(doc.content[0].content[0].attrs).toEqual({ caption: "In a quote", id: "tbl-q" });
  });

  describe("what is not a caption line", () => {
    test("Pandoc's longer `Table:` spelling is a paragraph", () => {
      const { doc } = read(`${TABLE}\nTable: Plans\n`);
      expect(doc.content[0]).not.toHaveProperty("attrs");
      expect(doc.content[1].type).toBe("paragraph");
    });

    test("a line directly under the rows is another row, as GFM reads it", () => {
      const { doc } = read(`${TABLE}: Plans\n`);
      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].content).toHaveLength(3);
      expect(doc.content[0]).not.toHaveProperty("attrs");
    });

    test("a paragraph that is not right after a table", () => {
      const { doc } = read(`Text.\n\n: Plans\n`);
      expect(doc.content.map((n) => n.type)).toEqual(["paragraph", "paragraph"]);
    });

    test("a `:` with no space or brace after it — an emoji code", () => {
      const { doc } = read(`${TABLE}\n:smile: fine\n`);
      expect(doc.content[0]).not.toHaveProperty("attrs");
      expect(doc.content[1].type).toBe("paragraph");
    });

    test("a `:` alone", () => {
      const { doc } = read(`${TABLE}\n:\n`);
      expect(doc.content[1].type).toBe("paragraph");
    });

    test("only the first paragraph after a table", () => {
      const { doc } = read(`${TABLE}\n: Plans\n\n: Not a caption\n`);
      expect(doc.content[0].attrs).toEqual({ caption: "Plans" });
      expect(doc.content[1].type).toBe("paragraph");
    });
  });
});
