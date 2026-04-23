/**
 * @fileoverview Base schema definition compatible with TipTap v2
 */

const baseNodes = {
    doc: {
        content: "block+",
    },

    paragraph: {
        content: "inline*",
        group: "block",
    },

    heading: {
        attrs: {
            level: { default: 1 },
            id: { default: null },
        },
        content: "inline*",
        group: "block",
    },

    eyebrowHeading: {
        content: "inline*",
        group: "block",
    },

    text: {
        group: "inline",
    },

    image: {
        attrs: {
            // Core attributes
            src: {},
            caption: { default: null },
            alt: { default: null },
            role: { default: "image" }, // image, icon, hero, video, pdf, etc.
            // Dimension attributes
            width: { default: null },
            height: { default: null },
            // Loading behavior
            loading: { default: null }, // lazy, eager
            // Media attributes (for video/document roles)
            poster: { default: null },  // Explicit poster image for videos
            preview: { default: null }, // Preview image for PDFs/documents
            // Video-specific attributes
            autoplay: { default: null },
            muted: { default: null },
            loop: { default: null },
            controls: { default: null },
            // Styling attributes
            fit: { default: null },     // object-fit: cover, contain, fill, etc.
            position: { default: null }, // object-position
            // Generic attributes
            class: { default: null },
            id: { default: null },
        },
        // group: "block inline",
    },

    inset_ref: {
        attrs: {
            component: {},
            alt: { default: null },
            // Dynamic attributes from {key=value} syntax are also stored here
        },
        group: "block",
    },

    inset_placeholder: {
        attrs: {
            refId: {},
        },
        group: "block",
    },

    divider: {
        attrs: {
            style: { default: "line" },
            size: { default: "normal" },
        },
        group: "block",
    },

    // List nodes
    bulletList: {
        content: "listItem+",
        group: "block",
    },

    orderedList: {
        attrs: {
            start: { default: 1 },
        },
        content: "listItem+",
        group: "block",
    },

    listItem: {
        content: "paragraph block*",
        defining: true,
    },

    // Code blocks
    codeBlock: {
        attrs: {
            language: { default: null },
            filename: { default: null },
        },
        content: "text*",
        marks: "", // No marks (formatting) allowed inside code blocks
        group: "block",
        code: true,
        defining: true,
    },
    blockquote: {
        content: "inline*",
        group: "block",
    },

    // Math nodes — LaTeX compiled to MathML Core at parse time.
    // The `mathml` attr is the HTML string that flows through the content
    // pipeline and lands in kit's HTML renderers via dangerouslySetInnerHTML.
    // The `latex` attr is the source — kept for roundtrip (content-writer)
    // and editor popover display.
    math_inline: {
        attrs: {
            latex: { default: "" },
            mathml: { default: "" },
            // `display: true` marks mid-paragraph $$...$$ — rendered with
            // displayMode styling but still occupying an inline slot.
            // Preserves the Pandoc distinction through roundtrip.
            display: { default: false },
        },
        group: "inline",
        inline: true,
        atom: true,
        selectable: true,
        // parseDOM recovers nodes from HTML previously produced by toDOM
        // (copy/paste, Tiptap export). Alien pastes with only data-latex
        // yield an empty mathml; a future normalisation pass can backfill
        // via latexToMathML if needed. This runs in schema-consumer
        // contexts that must stay Temml-free, so do not call it here.
        parseDOM: [
            {
                tag: 'span[data-type="inline-math"]',
                getAttrs: (el) => ({
                    latex: el.getAttribute("data-latex") || "",
                    mathml: el.innerHTML || "",
                }),
            },
        ],
        toDOM: (node) => {
            // In non-DOM contexts (SSR, test suites without jsdom) return the
            // spec form. The authoritative HTML serialiser for runtime is
            // semantic-parser's getTextContent, not DOMSerializer.
            if (typeof document === "undefined") {
                return [
                    "span",
                    {
                        "data-type": "inline-math",
                        "data-latex": node.attrs.latex,
                    },
                ];
            }
            const span = document.createElement("span");
            span.setAttribute("data-type", "inline-math");
            span.setAttribute("data-latex", node.attrs.latex);
            const tpl = document.createElement("template");
            tpl.innerHTML = node.attrs.mathml || "";
            span.appendChild(tpl.content);
            return span;
        },
    },

    math_display: {
        attrs: {
            latex: { default: "" },
            mathml: { default: "" },
        },
        group: "block",
        atom: true,
        selectable: true,
        parseDOM: [
            {
                tag: 'div[data-type="block-math"]',
                getAttrs: (el) => ({
                    latex: el.getAttribute("data-latex") || "",
                    mathml: el.innerHTML || "",
                }),
            },
        ],
        toDOM: (node) => {
            if (typeof document === "undefined") {
                return [
                    "div",
                    {
                        "data-type": "block-math",
                        "data-latex": node.attrs.latex,
                    },
                ];
            }
            const div = document.createElement("div");
            div.setAttribute("data-type", "block-math");
            div.setAttribute("data-latex", node.attrs.latex);
            const tpl = document.createElement("template");
            tpl.innerHTML = node.attrs.mathml || "";
            div.appendChild(tpl.content);
            return div;
        },
    },
    // Table nodes
    table: {
        content: "tableRow+",
        group: "block",
        tableRole: "table",
    },

    tableRow: {
        content: "tableCell+",
        tableRole: "row",
    },

    tableCell: {
        content: "paragraph+",
        attrs: {
            colspan: { default: 1 },
            rowspan: { default: 1 },
            align: { default: null }, // left, center, right
            header: { default: false },
        },
        tableRole: "cell",
    },
};

const baseMarks = {
    bold: {},
    italic: {},
    link: {
        attrs: {
            href: {},
            title: { default: null },
            // Extended attributes
            target: { default: null },   // _blank, _self, etc.
            rel: { default: null },      // noopener, noreferrer, etc.
            download: { default: null }, // Download attribute (true or filename)
            class: { default: null },
        },
    },
    button: {
        attrs: {
            href: {},
            title: { default: null },
            variant: { default: "primary" }, // primary, secondary, outline, ghost, etc.
            // Extended attributes
            size: { default: null },     // sm, md, lg
            icon: { default: null },     // Icon name or path
            target: { default: null },
            rel: { default: null },
            download: { default: null },
            class: { default: null },
        },
    },
    code: {
        // For inline code
        inclusive: true,
        code: true,
    },
};

/**
 * Get the base schema definition
 * @returns {Object} Combined schema with nodes and marks
 */
function getBaseSchema() {
    return {
        nodes: baseNodes,
        marks: baseMarks,
    };
}

export { getBaseSchema };
