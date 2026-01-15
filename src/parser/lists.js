/**
 * @fileoverview Parse markdown lists
 */

import { marked } from "marked";
import { parseInline } from "./inline.js";

/**
 * Extract main content from a list item, excluding nested list content
 * @param {Object} item - List item token
 * @returns {string} Main content text
 */
function extractMainContent(item) {
    // Remove nested list markdown from the text
    const text = item.text || "";
    const lines = text.split("\n");
    return lines
        .filter(
            (line) =>
                !line.trim().startsWith("-") && !line.trim().match(/^\d+\./)
        )
        .join("\n");
}

/**
 * Parse list item text content
 * @param {Object} item - List item token
 * @param {Object} schema - ProseMirror schema
 * @returns {Array} Array of ProseMirror nodes for the item content
 */
function parseListItemContent(item, schema) {
    const mainContent = extractMainContent(item);
    const inlineTokens = marked.Lexer.lexInline(mainContent);

    const content = [
        {
            type: "paragraph",
            content: inlineTokens.flatMap((t) => parseInline(t, schema, true)),
        },
    ];

    // Handle nested lists by parsing them as new markdown
    if (item.text) {
        const lines = item.text.split("\n");
        let currentNested = [];
        let isNested = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("-") || trimmed.match(/^\d+\./)) {
                currentNested.push(line);
                isNested = true;
            } else if (isNested && trimmed === "") {
                currentNested.push(line);
            }
        }

        if (currentNested.length > 0) {
            const nestedMarkdown = currentNested.join("\n");
            const nestedTokens = marked.lexer(nestedMarkdown);

            for (const token of nestedTokens) {
                if (token.type === "list") {
                    content.push({
                        type: token.ordered ? "orderedList" : "bulletList",
                        ...(token.ordered && {
                            attrs: { start: token.start || 1 },
                        }),
                        content: parseListItems(token.items, schema),
                    });
                }
            }
        }
    }

    return content;
}

/**
 * Parse list items recursively
 * @param {Array} items - Array of list item tokens
 * @param {Object} schema - ProseMirror schema
 * @returns {Array} Array of ProseMirror list item nodes
 */
function parseListItems(items, schema) {
    return items.map((item) => ({
        type: "listItem",
        content: parseListItemContent(item, schema),
    }));
}

/**
 * Parse list block
 * @param {Object} token - List token
 * @param {Object} schema - ProseMirror schema
 * @returns {Object} ProseMirror list node
 */
function parseList(token, schema) {
    return {
        type: token.ordered ? "orderedList" : "bulletList",
        ...(token.ordered && { attrs: { start: token.start || 1 } }),
        content: parseListItems(token.items, schema),
    };
}

export { parseList, parseListItems };
