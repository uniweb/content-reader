/**
 * @fileoverview Main parser orchestration
 */

import { parseBlock } from "./block.js";
import { isEmptyContent } from "./utils.js";

/**
 * Parse markdown content into ProseMirror document structure
 * @param {Array} tokens - Array of marked tokens
 * @param {Object} schema - ProseMirror schema
 * @returns {Object} ProseMirror document
 */
function parseMarkdownContent(tokens, schema) {
    const content = [];
    for (let i = 0; i < tokens.length; i++) {
        const node = parseBlock(tokens[i], schema);
        if (node) {
            if (Array.isArray(node)) {
                content.push(...node);
            } else {
                content.push(node);
            }
        }
    }

    // Filter out any remaining null nodes and empty paragraphs
    return {
        type: "doc",
        content: content.filter((node) => {
            if (!node) return false;
            if (node.type === "paragraph" && isEmptyContent(node.content))
                return false;
            return true;
        }),
    };
}

export { parseMarkdownContent };
