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
