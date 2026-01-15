/**
 * @fileoverview Parse inline markdown elements
 */

/**
 * Parse inline markdown content into ProseMirror/Tiptap nodes
 * @param {Object} token - Marked token for inline content
 * @param {Object} schema - ProseMirror schema
 * @returns {Array} Array of ProseMirror inline nodes
 *
 * Notes on implementation choices:
 * - We use token.raw for plain text to avoid HTML entity encoding
 * - For formatted text (bold/italic), we use token.tokens to handle nested formatting
 * - Tiptap represents formatting as marks on text nodes, not nested structures
 * - HTML entities are only decoded for specific token types (codespan, link) where
 *   we need the processed content
 */
function parseInline(token, schema, removeNewLine = false) {
    if (token.type === "text") {
        if (removeNewLine && token.raw) {
            token.raw = token.raw.replace(/\n/g, "");
        }
        // Use raw to get unencoded characters (', ", &, etc.)
        // marked's .text property encodes these as HTML entities
        return token.raw ? [{ type: "text", text: token.raw }] : [];
    }

    if (token.type === "strong" || token.type === "em") {
        // Tiptap represents formatting as marks on text nodes
        // For nested formatting like **_text_**, all marks are applied to the same text node
        const mark = { type: token.type === "strong" ? "bold" : "italic" };

        return token.tokens.flatMap((t) =>
            parseInline(t, schema, removeNewLine).map((node) => ({
                ...node,
                marks: [...(node.marks || []), mark],
            }))
        );
    }

    if (token.type === "html") {
        // Handle HTML tokens however you need
        // You might want to strip the < > or process them differently
        return [{ type: "text", text: token.raw }];
    } else if (token.type === "br") {
        return [{ type: "text", text: "\n" }];
    }

    // Decode HTML entities
    const text = token.text
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&");

    if (token.type === "codespan") {
        return [
            {
                type: "text",
                marks: [{ type: "code" }],
                text,
            },
        ];
    }

    if (token.type === "link") {
        const isButton = token.href.startsWith("button:");
        const href = isButton ? token.href.substring(7) : token.href;

        return [
            {
                type: "text",
                marks: [
                    {
                        type: isButton ? "button" : "link",
                        attrs: {
                            href,
                            title: token.title || null,
                            ...(isButton && { variant: "primary" }),
                        },
                    },
                ],
                text,
            },
        ];
    }

    if (token.type === "image") {
        let role, src;

        // Find the first colon to handle role:url format correctly
        if (token.href.includes(":") && !token.href.startsWith("http")) {
            const colonIndex = token.href.indexOf(":");
            role = token.href.substring(0, colonIndex);
            src = token.href.substring(colonIndex + 1);
        } else {
            role = "image";
            src = token.href;
        }

        return [
            {
                type: "image",
                attrs: {
                    src,
                    caption: token.title || null,
                    alt: text || null,
                    role,
                },
            },
        ];
    }

    // Handle unknown token types as plain text
    return token.raw ? [{ type: "text", text: token.raw }] : [];
}

export { parseInline };
