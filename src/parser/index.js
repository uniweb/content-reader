/**
 * @fileoverview Main parser orchestration
 */

import { parseBlocks } from "./block.js";
import { isEmptyContent } from "./utils.js";

/**
 * Parse markdown content into ProseMirror document structure
 * @param {Array} tokens - Array of marked tokens
 * @param {Object} schema - ProseMirror schema
 * @returns {Object} ProseMirror document
 */
function parseMarkdownContent(tokens, schema) {
    // The one walk a container's blocks take too, so a table finds its caption
    // line at the top level as it does inside a blockquote.
    const content = parseBlocks(tokens, schema);

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
