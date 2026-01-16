/**
 * @fileoverview Main entry point for the content-reader package.
 * Exports the main function to convert markdown to ProseMirror structure.
 */

import { marked } from "marked";
import { parseMarkdownContent } from "./parser/index.js";
import { getBaseSchema } from "./schema/index.js";
import { isValidUniwebMarkdown } from "./utils.js";
import { getMarkedExtensions } from "./parser/marked-extensions.js";

// Configure marked with our custom extensions for attribute syntax
marked.use(getMarkedExtensions());

/**
 * Convert markdown content to ProseMirror document structure
 * @param {string} markdown - The markdown content to parse
 * @returns {Object} ProseMirror document structure
 */
function markdownToProseMirror(markdown) {
    const schema = getBaseSchema();
    const tokens = marked.lexer(markdown);
    return parseMarkdownContent(tokens, schema);
}

export { markdownToProseMirror, isValidUniwebMarkdown };
