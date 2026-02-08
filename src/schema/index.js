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
