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
            tag: null,
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

  test("parses code blocks with tags", () => {
    const markdown = "```json:nav-links\n[{\"label\": \"Home\"}]\n```";
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: {
            language: "json",
            tag: "nav-links",
          },
          content: [
            {
              type: "text",
              text: '[{"label": "Home"}]',
            },
          ],
        },
      ],
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
            tag: null,
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
            tag: null,
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
