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

    if (token.type === "span") {
        // Bracketed span: [text]{.class}
        // Supports nested formatting via tokens
        const { class: className, id, ...otherAttrs } = token.attrs || {};

        const spanMark = {
            type: "span",
            attrs: {
                ...(className && { class: className }),
                ...(id && { id }),
                ...otherAttrs,
            },
        };

        // If there are child tokens (nested formatting), process them
        if (token.tokens && token.tokens.length > 0) {
            return token.tokens.flatMap((t) =>
                parseInline(t, schema, removeNewLine).map((node) => ({
                    ...node,
                    marks: [...(node.marks || []), spanMark],
                }))
            );
        }

        // Simple text span
        return [
            {
                type: "text",
                marks: [spanMark],
                text: token.text,
            },
        ];
    }

    if (token.type === "link") {
        // Check for button: prefix or .button class in attrs
        const hasButtonPrefix = token.href.startsWith("button:");
        const hasButtonClass = token.attrs?.class?.includes("button");
        const isButton = hasButtonPrefix || hasButtonClass;

        const href = hasButtonPrefix ? token.href.substring(7) : token.href;

        // Extract known link/button attributes from curly brace attrs
        const {
            variant = "primary",
            download,
            target,
            rel,
            size,
            icon,
            ...otherAttrs
        } = token.attrs || {};

        // Remove 'button' from class if present (it's used as a type indicator)
        let className = otherAttrs.class;
        if (className) {
            className = className.replace(/\bbutton\b/, "").trim() || undefined;
        }

        return [
            {
                type: "text",
                marks: [
                    {
                        type: isButton ? "button" : "link",
                        attrs: {
                            href,
                            title: token.title || null,
                            ...(isButton && { variant }),
                            ...(download !== undefined && { download }),
                            ...(target && { target }),
                            ...(rel && { rel }),
                            ...(size && { size }),
                            ...(icon && { icon }),
                            ...(className && { class: className }),
                        },
                    },
                ],
                text,
            },
        ];
    }

    if (token.type === "image") {
        let role, src, iconLibrary, iconName;

        // Check for icon protocol prefixes (lucide:, heroicons:, etc.)
        const iconMatch = token.href.match(/^(lucide|heroicons|phosphor|tabler|feather|icon):(.+)$/);
        if (iconMatch) {
            iconLibrary = iconMatch[1];
            iconName = iconMatch[2];
            role = "icon";
            // For known icon libraries, use the name; for generic 'icon:', use as URL
            src = iconLibrary === "icon" ? iconName : null;
        }
        // Find the first colon to handle role:url format correctly (legacy syntax)
        else if (token.href.includes(":") && !token.href.startsWith("http")) {
            const colonIndex = token.href.indexOf(":");
            role = token.href.substring(0, colonIndex);
            src = token.href.substring(colonIndex + 1);
        } else {
            src = token.href;
        }

        // Extract known image attributes from curly brace attrs
        const {
            role: attrRole,
            width,
            height,
            size,         // Icon size (shorthand for width=height)
            loading,
            poster,       // For videos: explicit poster image
            preview,      // For PDFs/documents: preview image
            autoplay,
            muted,
            loop,
            controls,
            fit,          // object-fit: cover, contain, etc.
            position,     // object-position
            color,        // Icon color
            ...otherAttrs
        } = token.attrs || {};

        // Attribute role takes precedence over prefix role
        const finalRole = attrRole || role || "image";

        return [
            {
                type: "image",
                attrs: {
                    src,
                    caption: token.title || null,
                    alt: text || null,
                    role: finalRole,
                    // Icon-specific attributes
                    ...(iconLibrary && iconLibrary !== "icon" && { library: iconLibrary }),
                    ...(iconName && { name: iconName }),
                    ...(size && { size }),
                    ...(color && { color }),
                    // Dimension attributes
                    ...(width && { width: parseInt(width, 10) || width }),
                    ...(height && { height: parseInt(height, 10) || height }),
                    // Loading behavior
                    ...(loading && { loading }),
                    // Media attributes (for video/document roles)
                    ...(poster && { poster }),
                    ...(preview && { preview }),
                    // Video-specific attributes
                    ...(autoplay !== undefined && { autoplay }),
                    ...(muted !== undefined && { muted }),
                    ...(loop !== undefined && { loop }),
                    ...(controls !== undefined && { controls }),
                    // Styling attributes
                    ...(fit && { fit }),
                    ...(position && { position }),
                    // Any other custom attributes
                    ...(otherAttrs.class && { class: otherAttrs.class }),
                    ...(otherAttrs.id && { id: otherAttrs.id }),
                },
            },
        ];
    }

    // Handle unknown token types as plain text
    return token.raw ? [{ type: "text", text: token.raw }] : [];
}

export { parseInline };
