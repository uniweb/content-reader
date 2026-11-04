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

/**
 * Markdown as its top-level blocks, each with the text it was read from and the nodes it reads to,
 * so a writer can keep an author's text for each block an edit left alone and write only the blocks
 * it changed.
 *
 * `head` is the text before the first block, and each block's `after` what follows it up to the next:
 * blank lines, and text the lexer reads as no block — a link reference definition. `head` + each
 * block's `text` + `after`, in order, is the markdown exactly.
 *
 * ⭐ Null when the blocks read one at a time do not give the document read whole — when a construct
 * spans two of them, such as a table and the caption line after it. A writer then has no block of the
 * author's text it can say holds which nodes, and writes the whole.
 *
 * @param {string} markdown
 * @returns {{ head: string, blocks: Array<{ text: string, after: string, nodes: Object[] }> } | null}
 */
function markdownBlocks(markdown) {
    const source = String(markdown ?? "");
    const schema = getBaseSchema();
    const read = (tokens) =>
        collectWarnings(() => parseMarkdownContent(tokens, schema)).result.content;
    const tokens = marked.lexer(source);
    // Lexed again for the whole: a parse may consume what it is handed.
    const whole = read(marked.lexer(source));
    let head = "";
    const blocks = [];
    const between = (text) => {
        if (blocks.length) blocks[blocks.length - 1].after += text;
        else head += text;
    };
    let at = 0;
    for (const token of tokens) {
        // Where the lexer found it: what lies before is text it read as no block.
        const start = source.indexOf(token.raw, at);
        if (start < 0) return null;
        between(source.slice(at, start));
        at = start + token.raw.length;
        if (token.type === "space") {
            between(token.raw);
            continue;
        }
        const text = token.raw.replace(/\n+$/, "");
        const one = Object.assign([token], { links: tokens.links });
        blocks.push({ text, after: token.raw.slice(text.length), nodes: read(one) });
    }
    between(source.slice(at));
    if (JSON.stringify(blocks.flatMap((b) => b.nodes)) !== JSON.stringify(whole)) return null;
    return { head, blocks };
}

export { markdownToProseMirror, inlineMarkdownToProseMirror, markdownBlocks, isValidUniwebMarkdown };

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
