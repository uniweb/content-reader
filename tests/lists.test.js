import { markdownToProseMirror } from "../src/index.js";

describe("List Parsing", () => {
  test("parses unordered list", () => {
    const markdown = `
- First item
- Second item
- Third item`;

    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "First item" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Second item" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Third item" }],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  test("parses ordered list", () => {
    const markdown = `
1. First item
2. Second item
3. Third item`;

    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "orderedList",
          attrs: { start: 1 },
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "First item" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Second item" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Third item" }],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  test("parses nested lists", () => {
    const markdown = `
- First item
  - Nested item 1
  - Nested item 2
- Second item
  1. Nested ordered 1
  2. Nested ordered 2`;

    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "First item" }],
                },
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Nested item 1" }],
                        },
                      ],
                    },
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Nested item 2" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Second item" }],
                },
                {
                  type: "orderedList",
                  attrs: { start: 1 },
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Nested ordered 1" }],
                        },
                      ],
                    },
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Nested ordered 2" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  test("parses list items with formatted text", () => {
    const markdown = `
- Item with **bold** text
- Item with *italic* text
- Item with [link](https://example.com)`;

    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Item with " },
                    { type: "text", text: "bold", marks: [{ type: "bold" }] },
                    { type: "text", text: " text" },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Item with " },
                    {
                      type: "text",
                      text: "italic",
                      marks: [{ type: "italic" }],
                    },
                    { type: "text", text: " text" },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Item with " },
                    {
                      type: "text",
                      text: "link",
                      marks: [
                        {
                          type: "link",
                          attrs: {
                            href: "https://example.com",
                            title: null,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  // A list item wrapped onto a second source line keeps the soft break, as a
  // paragraph does. It was deleted, fusing the words either side of it:
  // "of its" + "sub-organizations" → "itssub-organizations".
  test("keeps a soft line break inside a wrapped list item", () => {
    const markdown = `- **Storage** is shared by all of its
  sub-organizations — see
  [Account](page:docs/a).`;

    const paragraph = markdownToProseMirror(markdown).content[0].content[0].content[0];
    const text = paragraph.content.map((n) => n.text).join("|");

    expect(text).toBe("Storage| is shared by all of its\nsub-organizations — see\n|Account|.");
  });

  test("a wrapped list item and a wrapped paragraph keep the same text", () => {
    const item = markdownToProseMirror("- one\n  two").content[0].content[0].content[0];
    const para = markdownToProseMirror("one\ntwo").content[0];

    expect(item.content).toEqual(para.content);
  });
});
