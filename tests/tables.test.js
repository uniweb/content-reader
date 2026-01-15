import { markdownToProseMirror } from "../src/index.js";

describe("Table Parsing", () => {
  test("parses basic table", () => {
    const markdown = `
| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |`;

    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1, align: null, header: true },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Column 1" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1, align: null, header: true },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Column 2" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1, align: null, header: false },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Cell 1" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1, align: null, header: false },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Cell 2" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1, align: null, header: false },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Cell 3" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1, align: null, header: false },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Cell 4" }],
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

  test("parses table with alignments", () => {
    const markdown = `
| Left | Center | Right |
|:-----|:------:|------:|
| 1    |   2    |     3 |`;

    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: {
                    colspan: 1,
                    rowspan: 1,
                    align: "left",
                    header: true,
                  },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Left" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  attrs: {
                    colspan: 1,
                    rowspan: 1,
                    align: "center",
                    header: true,
                  },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Center" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  attrs: {
                    colspan: 1,
                    rowspan: 1,
                    align: "right",
                    header: true,
                  },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Right" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: {
                    colspan: 1,
                    rowspan: 1,
                    align: "left",
                    header: false,
                  },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "1" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  attrs: {
                    colspan: 1,
                    rowspan: 1,
                    align: "center",
                    header: false,
                  },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "2" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  attrs: {
                    colspan: 1,
                    rowspan: 1,
                    align: "right",
                    header: false,
                  },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "3" }],
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

  test("parses table with formatted content", () => {
    const markdown = `
| Style | Example |
|-------|---------|
| Bold | **text** |
| Link | [link](https://example.com) |`;

    const result = markdownToProseMirror(markdown);

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1, align: null, header: true },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Style" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1, align: null, header: true },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Example" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1, align: null, header: false },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Bold" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1, align: null, header: false },
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          marks: [{ type: "bold" }],
                          text: "text",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1, align: null, header: false },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Link" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1, align: null, header: false },
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          marks: [
                            {
                              type: "link",
                              attrs: {
                                href: "https://example.com",
                                title: null,
                              },
                            },
                          ],
                          text: "link",
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
});
