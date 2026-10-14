/**
 * @fileoverview Main entry point for the content-reader package.
 * Exports the main function to convert markdown to ProseMirror structure.
 */

import { marked } from "marked";
import { parseMarkdownContent } from "./parser/index.js";
import { getBaseSchema } from "./schema/index.js";
import { isValidUniwebMarkdown } from "./utils.js";
import { getMarkedExtensions } from "./parser/marked-extensions.js";
import { collectWarnings } from "./parser/warnings.js";

// Configure marked with our custom extensions for attribute syntax
marked.use(getMarkedExtensions());

/**
 * Convert markdown content to ProseMirror document structure.
 *
 * A text node holds the characters a reader sees. HTML in the markdown is not
 * content: it stays the text it is and shows as written, except `<br>`, which
 * becomes a hard break. Each such tag is reported to `onWarning`, once per
 * distinct message, so a caller can name the file.
 *
 * @param {string} markdown - The markdown content to parse
 * @param {Object} [options]
 * @param {(message: string) => void} [options.onWarning] - Told what the parse
 *   could not honour
 * @returns {Object} ProseMirror document structure
 */
function markdownToProseMirror(markdown, { onWarning } = {}) {
    const schema = getBaseSchema();
    const { result, warnings } = collectWarnings(() =>
        parseMarkdownContent(marked.lexer(markdown), schema),
    );
    if (onWarning) warnings.forEach((message) => onWarning(message));
    return result;
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
