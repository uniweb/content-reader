import { markdownToProseMirror } from "../src/index.js";

describe("Code Parsing", () => {
  test("parses fenced code blocks and single quotes", () => {
    const markdown = "```javascript\nconst x = 1;\nconsole.log('x:', x);\n```";
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: {
            language: "javascript",
          },
          content: [
            {
              type: "text",
              text: "const x = 1;\nconsole.log('x:', x);",
            },
          ],
        },
      ],
    });
  });

  test("parses tagged code blocks as dataBlocks", () => {
    const markdown = "```json:nav-links\n[{\"label\": \"Home\"}]\n```";
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "dataBlock",  // Structured data, not code for display
          attrs: {
            tag: "nav-links",
            // The serialization the author chose. Recorded so the block can be
            // written back as they wrote it — without it, content-writer has
            // only the parsed value and has to guess a format.
            language: "json",
            data: [{ label: "Home" }],
          },
        },
      ],
    });
  });

  test("records yaml as the data block's language", () => {
    const result = markdownToProseMirror("```yaml:nav\n- label: Docs\n```");

    expect(result.content[0]).toEqual({
      type: "dataBlock",
      attrs: {
        tag: "nav",
        language: "yaml",
        data: [{ label: "Docs" }],
      },
    });
  });

  // An unquoted date in a yaml data block is the text the author wrote — the value a
  // quoted one has, and the value a site's YAML files keep. js-yaml's default schema made
  // it a `Date`, whose only JSON form is a timestamp the author never wrote, and which a
  // query comparing strings cannot compare.
  test("keeps an unquoted date or timestamp in a yaml data block as written", () => {
    const node = markdownToProseMirror(
      "```yaml:event\ndate: 2025-06-01\nat: 2025-06-01T10:20:30Z\nquoted: '2025-06-01'\nexplicit: !!timestamp 2025-06-01\n```"
    ).content[0];
    expect(node.type).toBe("dataBlock");
    expect(node.attrs.data).toEqual({
      date: "2025-06-01",
      at: "2025-06-01T10:20:30Z",
      quoted: "2025-06-01",
      explicit: "2025-06-01",
    });
  });

  test("resolves every other yaml type as before — numbers, booleans, null, merge keys", () => {
    const node = markdownToProseMirror(
      "```yaml:plan\ncount: 3\nprice: 1.5\nlive: true\nnote: ~\nbase: &b { tier: pro }\nplan:\n  <<: *b\n  seats: 5\n```"
    ).content[0];
    expect(node.attrs.data).toEqual({ count: 3, price: 1.5, live: true, note: null, base: { tier: "pro" }, plan: { tier: "pro", seats: 5 } });
  });

  test("parses indented code blocks", () => {
    const markdown = "    const x = 1;\n    console.log(x);";
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: {
            language: null,
          },
          content: [
            {
              type: "text",
              text: "const x = 1;\nconsole.log(x);",
            },
          ],
        },
      ],
    });
  });

  test("parses inline code", () => {
    const markdown = "Use the `console.log('test')` function.";
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Use the " },
            {
              type: "text",
              text: "console.log('test')",
              marks: [{ type: "code" }],
            },
            { type: "text", text: " function." },
          ],
        },
      ],
    });
  });

  test("preserves empty lines in code blocks", () => {
    const markdown = "```\nline 1\n\nline 2\n```";
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: {
            language: null,
          },
          content: [
            {
              type: "text",
              text: "line 1\n\nline 2",
            },
          ],
        },
      ],
    });
  });
});

describe("Container fences — the block form of an inset", () => {
    test("a fence whose info names a component parses to inset_block", () => {
        const result = markdownToProseMirror("```@Details\nSummary\n\nBody text\n```");

        expect(result.content[0]).toEqual({
            type: "inset_block",
            attrs: { component: "Details" },
            content: [
                { type: "paragraph", content: [{ type: "text", text: "Summary" }] },
                { type: "paragraph", content: [{ type: "text", text: "Body text" }] },
            ],
        });
    });

    test("params ride on the info string", () => {
        const result = markdownToProseMirror("```@Alert{type=warning}\nCareful.\n```");
        expect(result.content[0].attrs).toEqual({ component: "Alert", type: "warning" });
    });

    test("the body is markdown, not text — marks and blocks survive", () => {
        const result = markdownToProseMirror(
            "```@Alert{type=warning}\nBe **careful**.\n\n- one\n- two\n```"
        );
        const kinds = result.content[0].content.map(n => n.type);
        expect(kinds).toEqual(["paragraph", "bulletList"]);
    });

    test("a code block inside a container survives the wider outer fence", () => {
        // The case §3.2's caveat calls for, and the reason the body cannot be
        // inline-only: a code sample in a warning is ordinary documentation.
        const result = markdownToProseMirror(
            "````@Alert{type=warning}\nDo not:\n\n```js\nconst x = 1\n```\n````"
        );
        const kinds = result.content[0].content.map(n => n.type);
        expect(kinds).toEqual(["paragraph", "codeBlock"]);
    });

    test("an ordinary fence is untouched — the branch is purely additive", () => {
        expect(markdownToProseMirror("```js\nconst x = 1\n```").content[0].type).toBe("codeBlock");
        expect(markdownToProseMirror("```yaml:nav\n- a: 1\n```").content[0].type).toBe("dataBlock");
    });

    test("a malformed component token falls through to a code block", () => {
        // Rather than becoming a container with a nonsense name.
        expect(markdownToProseMirror("```@\nbody\n```").content[0].type).toBe("codeBlock");
        expect(markdownToProseMirror("```@9bad\nbody\n```").content[0].type).toBe("codeBlock");
    });
});

describe("Concept blocks — ```md:<tag>", () => {
    test("a md: fence becomes a concept_block whose body is parsed as blocks", () => {
        const result = markdownToProseMirror(
            "```md:faq\n# A question\nAn answer.\n\n# Another\nAlso answered.\n```"
        );

        expect(result.content).toHaveLength(1);
        const node = result.content[0];
        expect(node.type).toBe("concept_block");
        expect(node.attrs).toEqual({ tag: "faq" });
        expect(node.content.map(n => n.type)).toEqual([
            "heading", "paragraph", "heading", "paragraph",
        ]);
    });

    test("the body keeps its marks and links — it is content, not a string", () => {
        // The whole point of parsing at read time: nothing downstream has to
        // re-parse a string as markdown to find out there was a link in it.
        const node = markdownToProseMirror(
            "```md:faq\n# Q\nAn answer with **bold** and a [link](/x).\n```"
        ).content[0];

        const para = node.content.find(n => n.type === "paragraph");
        const marks = para.content.flatMap(c => (c.marks || []).map(m => m.type));
        expect(marks).toEqual(expect.arrayContaining(["bold", "link"]));
    });

    test("block content nests — lists, quotes and code samples all survive", () => {
        const node = markdownToProseMirror(
            "````md:faq\n# Q\n- one\n- two\n\n> quoted\n\n```js\nconst x = 1\n```\n````"
        ).content[0];

        expect(node.type).toBe("concept_block");
        expect(node.content.map(n => n.type)).toEqual([
            "heading", "bulletList", "blockquote", "codeBlock",
        ]);
    });

    test("a headingless body is still a concept block — that is a callout", () => {
        // ```md:warning is the same node with no headings in it. The shape is
        // fixed by the fence, so there is no second parse mode to select.
        const node = markdownToProseMirror(
            "```md:warning\nBack up your database **first**.\n\n- Not reversible\n```"
        ).content[0];

        expect(node.type).toBe("concept_block");
        expect(node.attrs.tag).toBe("warning");
        expect(node.content.map(n => n.type)).toEqual(["paragraph", "bulletList"]);
    });

    test("the tag is opaque — any name works, none is special", () => {
        // If this ever needs updating because a tag started behaving
        // differently, a concept registry has grown in the framework.
        for (const tag of ["faq", "warning", "steps", "glossary", "not-a-real-concept"]) {
            const node = markdownToProseMirror(`\`\`\`md:${tag}\n# T\nB\n\`\`\``).content[0];
            expect(node.type).toBe("concept_block");
            expect(node.attrs.tag).toBe(tag);
        }
    });

    test("an untagged md fence stays a code block — the tag is what makes it one", () => {
        const node = markdownToProseMirror("```md\n# Just a sample\n```").content[0];
        expect(node.type).toBe("codeBlock");
        expect(node.attrs.language).toBe("md");
    });

    test("neighbouring fences are untouched — the branch is purely additive", () => {
        expect(markdownToProseMirror("```yaml:nav\n- a: 1\n```").content[0].type).toBe("dataBlock");
        expect(markdownToProseMirror("```json:Form\n{}\n```").content[0].type).toBe("dataBlock");
        expect(markdownToProseMirror("```@Alert\nbody\n```").content[0].type).toBe("inset_block");
        expect(markdownToProseMirror("```math\nE=mc^2\n```").content[0].type).toBe("math_display");
        expect(markdownToProseMirror("```js\nconst x = 1\n```").content[0].type).toBe("codeBlock");
    });
});

describe("a code block keeps its code as written", () => {
  // ⛔ Until 2026-10-19 the reader took the FIRST line's indentation off every
  // line that had it and trimmed the block, so code whose first line was
  // indented lost it, relative indentation could invert, and a pull wrote the
  // author's file back changed.
  const find = (node) => (node.type === "codeBlock" ? node : (node.content || []).map(find).find(Boolean));
  const codeOf = (md) => find(markdownToProseMirror(md)).content[0].text;

  test("its indentation included", () => {
    expect(codeOf("```py\n    def f():\n        return 1\n```")).toBe("    def f():\n        return 1");
  });

  test("a first line indented more than the rest keeps both lines' indents", () => {
    expect(codeOf("```html\n    <p>Hi</p>\n  <br>\n```")).toBe("    <p>Hi</p>\n  <br>");
  });

  test("CONTROL — a fence indented in a list item loses only its own indentation, as markdown says", () => {
    expect(codeOf("- item\n\n  ```js\n  let a = 1\n    let b = 2\n  ```\n")).toBe("let a = 1\n  let b = 2");
  });

  test("its characters are text, never markup", () => {
    expect(codeOf("```html\n<p>Hi & bye</p>\n```")).toBe("<p>Hi & bye</p>");
  });
});
