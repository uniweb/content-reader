/**
 * @fileoverview What a text node holds: the characters a reader sees.
 *
 * A text node holds TEXT, as ProseMirror defines it — never markup and never
 * HTML-escaped. marked hands back some token values escaped (a code span, a
 * backslash escape, a link title, an image's alt) and others as written (plain
 * text keeps an author's `&copy;` or `&lt;`), so every value is decoded once,
 * here, on its way into a node. Whatever later makes HTML from a node escapes
 * it again; nothing in between has to know which spelling arrived.
 *
 * Decoding is strict, as CommonMark's is: a reference counts only with its
 * semicolon, so `R&D` and `&notes` stay as written while `&lt;`, `&#60;` and
 * `&copy;` become `<`, `<` and `©`.
 *
 * ⛔ Until 2026-10-14 the rule was that a text node holds HTML: `&lt;` stayed
 * escaped, raw HTML an author wrote stayed markup, and the renderer pasted text
 * in as stored. An `<img src=x onerror=…>` in content ran on a published page,
 * and `if a<b then swap` showed as `if a`.
 */

import { decodeHTML, DecodingMode } from "entities/decode";

/**
 * Decode character references to the characters they name.
 *
 * @param {string} value
 * @returns {string}
 */
export function decodeText(value) {
    if (typeof value !== "string" || !value.includes("&")) return value;
    return decodeHTML(value, DecodingMode.Strict);
}

/** A line break written as HTML — the one tag content keeps, as a hard break. */
export function isLineBreakTag(raw) {
    return /^<br\s*\/?>$/i.test(String(raw).trim());
}
