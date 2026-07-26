/**
 * @fileoverview Parse markdown lists
 */

import { marked } from "marked";
import { parseInline } from "./inline.js";

/**
 * Parse the contents of one list item.
 *
 * A list item can hold any block content — a paragraph, a fenced code sample,
 * a blockquote, a table, a nested list — and marked has already parsed it into
 * `item.tokens`. This walks those tokens and maps each through the ordinary
 * block parser, so a block inside a list item is the same node it would be
 * anywhere else.
 *
 * It used to reconstruct the item by hand instead: strip any line beginning
 * with `-` or `1.` (a guess at where a nested list starts), lex whatever was
 * left as **inline**, and wrap the lot in a single paragraph. Only two kinds
 * of content existed to it, and everything else was flattened into prose — a
 * fenced sample under a bullet became an inline code span mid-sentence, losing
 * its language and its line breaks, in the rendered page as well as on a
 * round trip. That is why `parseBlock` is threaded in here.
 *
 * @param {Object} item - List item token
 * @param {Object} schema - ProseMirror schema
 * @param {Function} [parseBlock] - Block-token parser, injected by block.js
 * @returns {Array} Array of ProseMirror nodes for the item content
 */
function parseListItemContent(item, schema, parseBlock) {
    const content = [];

    for (const token of item.tokens || []) {
        // `space` is the blank line between an item's blocks — structure, not
        // content. Looseness is recorded on the list, not rebuilt from these.
        if (token.type === "space") continue;

        if (token.type === "text") {
            // The item's own prose. marked has lexed its inline tokens already.
            const inline = token.tokens?.length
                ? token.tokens
                : marked.Lexer.lexInline(token.text || "");
            content.push({
                type: "paragraph",
                content: inline.flatMap((t) => parseInline(t, schema, true)),
            });
            continue;
        }

        if (token.type === "list") {
            content.push(makeListNode(token, schema, parseBlock));
            continue;
        }

        const node = parseBlock?.(token, schema);
        if (node) content.push(node);
    }

    // An empty item still holds a paragraph, so consumers can rely on one.
    if (content.length === 0) {
        content.push({ type: "paragraph", content: [] });
    }

    return content;
}

/**
 * Parse list items recursively
 * @param {Array} items - Array of list item tokens
 * @param {Object} schema - ProseMirror schema
 * @param {Function} [parseBlock] - Block-token parser, injected by block.js
 * @returns {Array} Array of ProseMirror list item nodes
 */
function parseListItems(items, schema, parseBlock) {
    return items.map((item) => ({
        type: "listItem",
        content: parseListItemContent(item, schema, parseBlock),
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
 * @param {Function} [parseBlock] - Block-token parser, injected by block.js
 * @returns {Object} ProseMirror list node
 */
function makeListNode(token, schema, parseBlock) {
    const attrs = {
        ...(token.ordered && { start: token.start || 1 }),
        ...(token.loose && { loose: true }),
    };

    return {
        type: token.ordered ? "orderedList" : "bulletList",
        ...(Object.keys(attrs).length > 0 && { attrs }),
        content: parseListItems(token.items, schema, parseBlock),
    };
}

/**
 * Parse list block
 * @param {Object} token - List token
 * @param {Object} schema - ProseMirror schema
 * @param {Function} [parseBlock] - Block-token parser. Injected rather than
 *   imported: block.js already imports this module, and a list item can hold
 *   any block, so importing it back would be a cycle.
 * @returns {Object} ProseMirror list node
 */
function parseList(token, schema, parseBlock) {
    return makeListNode(token, schema, parseBlock);
}

export { parseList, parseListItems };
