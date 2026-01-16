import { markdownToProseMirror } from "../src/index.js";

describe("Basic Markdown Parsing", () => {
  test("handles plain text with special characters", () => {
    const markdown = `text with 'single', "double", & specials – — © ® ™`;
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: `text with 'single', "double", & specials – — © ® ™`,
            },
          ],
        },
      ],
    });
  });

  test("parses accidental HTML paragraph", () => {
    const markdown = `Some <tag looking> text`;
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Some ",
            },
            {
              type: "text",
              text: "<tag looking>",
            },
            {
              type: "text",
              text: " text",
            },
          ],
        },
      ],
    });
  });

  test("parses basic formatting", () => {
    const markdown = "Some **bold** and *italic* text";
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Some " },
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " and " },
            { type: "text", text: "italic", marks: [{ type: "italic" }] },
            { type: "text", text: " text" },
          ],
        },
      ],
    });
  });

  test("handles nested formatting", () => {
    const markdown = `**_bold italic_** text with **bold *then italic*** and *italic **then bold***`;
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "bold italic",
              marks: [{ type: "italic" }, { type: "bold" }],
            },
            { type: "text", text: " text with " },
            { type: "text", text: "bold ", marks: [{ type: "bold" }] },
            {
              type: "text",
              text: "then italic",
              marks: [{ type: "italic" }, { type: "bold" }],
            },
            { type: "text", text: " and " },
            { type: "text", text: "italic ", marks: [{ type: "italic" }] },
            {
              type: "text",
              text: "then bold",
              marks: [{ type: "bold" }, { type: "italic" }],
            },
          ],
        },
      ],
    });
  });

  test("triple nested formatting", () => {
    const markdown = `***bold italic both***`;
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "bold italic both",
              marks: [{ type: "bold" }, { type: "italic" }],
            },
          ],
        },
      ],
    });
  });

  test("parses headings", () => {
    const markdown = "# Main Title\n## Subtitle";
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1, id: null },
          content: [{ type: "text", text: "Main Title" }],
        },
        {
          type: "heading",
          attrs: { level: 2, id: null },
          content: [{ type: "text", text: "Subtitle" }],
        },
      ],
    });
  });

  test("parses links", () => {
    const markdown = '[Link text](https://example.com "Title")';
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Link text",
              marks: [
                {
                  type: "link",
                  attrs: {
                    href: "https://example.com",
                    title: "Title",
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });
});

describe("Extended Syntax", () => {
  test("parses images without role", () => {
    // Images are extracted from paragraphs to root level for component rendering
    const markdown = "![Alt Text](path/to/image.svg)";
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "path/to/image.svg",
            caption: null,
            alt: "Alt Text",
            role: "image",
          },
        },
      ],
    });
  });

  test("parses images with roles", () => {
    // Images are extracted from paragraphs to root level for component rendering
    const markdown = '![Alt Text](icon:path/to/image.svg "Caption text")';
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "path/to/image.svg",
            caption: "Caption text",
            alt: "Alt Text",
            role: "icon",
          },
        },
      ],
    });
  });

  test("parses images with URL", () => {
    // Images are extracted from paragraphs to root level for component rendering
    const markdown = "![Alt Text](https://test.com)";
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "https://test.com",
            caption: null,
            alt: "Alt Text",
            role: "image",
          },
        },
      ],
    });
  });

  test("parses button links", () => {
    const markdown = "[Button Text](button:https://example.com)";
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Button Text",
              marks: [
                {
                  type: "button",
                  attrs: {
                    href: "https://example.com",
                    title: null,
                    variant: "primary",
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  //   test("parses eyebrow headings", () => {
  //     const markdown = "### Eyebrow\n# Main Title";
  //     const result = markdownToProseMirror(markdown);

  //     expect(result).toEqual({
  //       type: "doc",
  //       content: [
  //         {
  //           type: "eyebrowHeading",
  //           content: [{ type: "text", text: "Eyebrow" }],
  //         },
  //         {
  //           type: "heading",
  //           attrs: { level: 1, id: null },
  //           content: [{ type: "text", text: "Main Title" }],
  //         },
  //       ],
  //     });
  //   });

  test("parses dividers", () => {
    const markdown = "Text\n\n---\n\nMore text";
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Text" }],
        },
        {
          type: "divider",
          attrs: { style: "line", size: "normal" },
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "More text" }],
        },
      ],
    });
  });

  test("ignores HTML comments", () => {
    const markdown = "<!-- Comment -->\nText\n<!-- Another comment -->";
    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Text" }],
        },
      ],
    });
  });
});
