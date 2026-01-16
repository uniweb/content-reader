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

describe("Curly Brace Attributes", () => {
  test("parses image with role attribute", () => {
    const markdown = "![Hero Image](./hero.jpg){role=hero}";
    const result = markdownToProseMirror(markdown);

    expect(result.content[0]).toEqual({
      type: "image",
      attrs: expect.objectContaining({
        src: "./hero.jpg",
        alt: "Hero Image",
        role: "hero",
      }),
    });
  });

  test("parses image with multiple attributes", () => {
    const markdown = '![Photo](./photo.jpg "A beautiful photo"){width=800 height=600 loading=lazy}';
    const result = markdownToProseMirror(markdown);

    expect(result.content[0]).toEqual({
      type: "image",
      attrs: expect.objectContaining({
        src: "./photo.jpg",
        alt: "Photo",
        caption: "A beautiful photo",
        width: 800,
        height: 600,
        loading: "lazy",
      }),
    });
  });

  test("parses video with poster attribute", () => {
    const markdown = "![Intro Video](./intro.mp4){role=video poster=./poster.jpg autoplay muted loop}";
    const result = markdownToProseMirror(markdown);

    expect(result.content[0]).toEqual({
      type: "image",
      attrs: expect.objectContaining({
        src: "./intro.mp4",
        role: "video",
        poster: "./poster.jpg",
        autoplay: true,
        muted: true,
        loop: true,
      }),
    });
  });

  test("parses PDF with preview attribute", () => {
    const markdown = "![User Guide](./guide.pdf){role=pdf preview=./guide-preview.jpg}";
    const result = markdownToProseMirror(markdown);

    expect(result.content[0]).toEqual({
      type: "image",
      attrs: expect.objectContaining({
        src: "./guide.pdf",
        role: "pdf",
        preview: "./guide-preview.jpg",
      }),
    });
  });

  test("parses image with class and id", () => {
    const markdown = "![Logo](./logo.svg){.featured #main-logo}";
    const result = markdownToProseMirror(markdown);

    expect(result.content[0]).toEqual({
      type: "image",
      attrs: expect.objectContaining({
        src: "./logo.svg",
        class: "featured",
        id: "main-logo",
      }),
    });
  });

  test("parses link with target attribute", () => {
    const markdown = '[External Link](https://example.com){target=_blank rel="noopener noreferrer"}';
    const result = markdownToProseMirror(markdown);

    expect(result.content[0].content[0]).toEqual({
      type: "text",
      text: "External Link",
      marks: [
        {
          type: "link",
          attrs: expect.objectContaining({
            href: "https://example.com",
            target: "_blank",
            rel: "noopener noreferrer",
          }),
        },
      ],
    });
  });

  test("parses download link", () => {
    const markdown = "[Download PDF](./document.pdf){download}";
    const result = markdownToProseMirror(markdown);

    expect(result.content[0].content[0]).toEqual({
      type: "text",
      text: "Download PDF",
      marks: [
        {
          type: "link",
          attrs: expect.objectContaining({
            href: "./document.pdf",
            download: true,
          }),
        },
      ],
    });
  });

  test("parses button with .button class", () => {
    const markdown = "[Get Started](https://example.com){.button variant=secondary size=lg}";
    const result = markdownToProseMirror(markdown);

    expect(result.content[0].content[0]).toEqual({
      type: "text",
      text: "Get Started",
      marks: [
        {
          type: "button",
          attrs: expect.objectContaining({
            href: "https://example.com",
            variant: "secondary",
            size: "lg",
          }),
        },
      ],
    });
  });

  test("parses button with icon", () => {
    const markdown = "[Learn More](https://example.com){.button icon=arrow-right}";
    const result = markdownToProseMirror(markdown);

    expect(result.content[0].content[0]).toEqual({
      type: "text",
      text: "Learn More",
      marks: [
        {
          type: "button",
          attrs: expect.objectContaining({
            href: "https://example.com",
            icon: "arrow-right",
          }),
        },
      ],
    });
  });

  test("attribute role overrides prefix role (legacy compatibility)", () => {
    // If both prefix and attribute role are present, attribute takes precedence
    const markdown = "![Alt](icon:./image.svg){role=hero}";
    const result = markdownToProseMirror(markdown);

    expect(result.content[0].attrs.role).toBe("hero");
  });

  test("parses image with fit and position attributes", () => {
    const markdown = "![Background](./bg.jpg){fit=cover position=center}";
    const result = markdownToProseMirror(markdown);

    expect(result.content[0]).toEqual({
      type: "image",
      attrs: expect.objectContaining({
        src: "./bg.jpg",
        fit: "cover",
        position: "center",
      }),
    });
  });

  test("parses video with controls attribute", () => {
    const markdown = "![Demo Video](./demo.mp4){role=video controls muted}";
    const result = markdownToProseMirror(markdown);

    expect(result.content[0]).toEqual({
      type: "image",
      attrs: expect.objectContaining({
        src: "./demo.mp4",
        role: "video",
        controls: true,
        muted: true,
      }),
    });
  });

  test("parses download link with custom filename", () => {
    const markdown = '[Get Report](./data.pdf){download="annual-report.pdf"}';
    const result = markdownToProseMirror(markdown);

    expect(result.content[0].content[0]).toEqual({
      type: "text",
      text: "Get Report",
      marks: [
        {
          type: "link",
          attrs: expect.objectContaining({
            href: "./data.pdf",
            download: "annual-report.pdf",
          }),
        },
      ],
    });
  });

  test("parses image with multiple classes", () => {
    const markdown = "![Gallery](./photo.jpg){.featured .rounded .shadow}";
    const result = markdownToProseMirror(markdown);

    expect(result.content[0]).toEqual({
      type: "image",
      attrs: expect.objectContaining({
        src: "./photo.jpg",
        class: "featured rounded shadow",
      }),
    });
  });

  test("parses booleans in different positions", () => {
    const markdown = "![Video](./clip.mp4){muted role=video autoplay loop}";
    const result = markdownToProseMirror(markdown);

    expect(result.content[0]).toEqual({
      type: "image",
      attrs: expect.objectContaining({
        src: "./clip.mp4",
        role: "video",
        muted: true,
        autoplay: true,
        loop: true,
      }),
    });
  });
});
