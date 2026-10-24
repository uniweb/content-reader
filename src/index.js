/**
 * @fileoverview Main entry point for the content-reader package.
 * Exports the main function to convert markdown to ProseMirror structure.
 */

import { marked } from "marked";
import { parseMarkdownContent } from "./parser/index.js";
import { parseInlineTokens } from "./parser/inline.js";
import { getBaseSchema, PLACEMENTS } from "./schema/index.js";
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

/**
 * Read markdown as ONE element's inline content — the words a paragraph or a
 * heading holds — and never as blocks: `1. Introduction` is those words, not a
 * list, and `- Draft` is not a bullet. The inverse of content-writer's
 * `serializeInlineContent`, for a value that stands for one element's words,
 * such as a translation of a heading.
 *
 * The words read as a paragraph's do: a plain newline is a space, and HTML is
 * text, except `<br>` (see `markdownToProseMirror`).
 *
 * @param {string} markdown - Inline markdown
 * @param {Object} [options]
 * @param {(message: string) => void} [options.onWarning] - Told what the parse
 *   could not honour
 * @returns {Array} ProseMirror inline nodes
 */
function inlineMarkdownToProseMirror(markdown, { onWarning } = {}) {
    const schema = getBaseSchema();
    const source = String(markdown ?? "").replace(/\r\n?/g, "\n");
    const { result, warnings } = collectWarnings(() =>
        parseInlineTokens(marked.Lexer.lexInline(source, marked.defaults), schema),
    );
    if (onWarning) warnings.forEach((message) => onWarning(message));
    return result;
}

export { markdownToProseMirror, inlineMarkdownToProseMirror, isValidUniwebMarkdown };

// The framework's canonical ProseMirror dialect, as data: `{ nodes, marks }`
// with each type's attrs and defaults, TipTap-v2 shaped.
//
// Exported because it is a CONTRACT, not an internal: anything that renders or
// edits this content — a rich-text editor, a converter, any third-party tool —
// needs to know which types exist before it can tell "unknown because
// unregistered" from "unknown because malformed". The first is safe to preserve
// opaquely and write back verbatim; the second is not.
// `tests/schema-parity.test.js` keeps this honest against what the parser emits.
//
// `PLACEMENTS` are the values a block's `placement` may hold — where an image,
// a video or a table sits in a flow.
export { getBaseSchema, PLACEMENTS };
