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
            src: {},
            caption: { default: null },
            alt: { default: null },
            role: { default: "content" },
        },
        // group: "block inline",
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
        },
    },
    button: {
        attrs: {
            href: {},
            title: { default: null },
            variant: { default: "primary" },
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
