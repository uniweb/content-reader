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

// The framework's canonical ProseMirror dialect, as data: `{ nodes, marks }`
// with each type's attrs and defaults, TipTap-v2 shaped.
//
// Exported because it is a CONTRACT, not an internal: anything that renders or
// edits this content — a rich-text editor, a converter, any third-party tool —
// needs to know which types exist before it can tell "unknown because
// unregistered" from "unknown because malformed". The first is safe to preserve
// opaquely and write back verbatim; the second is not.
// `tests/schema-parity.test.js` keeps this honest against what the parser emits.
export { getBaseSchema };
