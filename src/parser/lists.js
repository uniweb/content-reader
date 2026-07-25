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
                    content.push(makeListNode(token, schema));
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
 * Build a ProseMirror list node from a marked list token.
 *
 * `loose` records whether the author separated items with blank lines — a
 * list-level property in CommonMark, which is exactly how marked reports it
 * (mixed spacing normalizes to one flag for the whole list). Without it a
 * loose list re-serializes tight, so an editor sync quietly reflows the
 * author's file.
 *
 * Only recorded when true, so the overwhelmingly common tight list keeps the
 * document it has today. Additive: consumers read list content and `start` by
 * name, and rendering does not branch on it — both spellings already produce
 * the same output.
 *
 * @param {Object} token - List token
 * @param {Object} schema - ProseMirror schema
 * @returns {Object} ProseMirror list node
 */
function makeListNode(token, schema) {
    const attrs = {
        ...(token.ordered && { start: token.start || 1 }),
        ...(token.loose && { loose: true }),
    };

    return {
        type: token.ordered ? "orderedList" : "bulletList",
        ...(Object.keys(attrs).length > 0 && { attrs }),
        content: parseListItems(token.items, schema),
    };
}

/**
 * Parse list block
 * @param {Object} token - List token
 * @param {Object} schema - ProseMirror schema
 * @returns {Object} ProseMirror list node
 */
function parseList(token, schema) {
    return makeListNode(token, schema);
}

export { parseList, parseListItems };
