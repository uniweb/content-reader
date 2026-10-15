/**
 * @fileoverview Parse markdown tables, and the caption line that may follow one
 */

import { marked } from "marked";
import { parseInline } from "./inline.js";
import { readPlacement } from "./placement.js";
import { warn } from "./warnings.js";

/**
 * Extract alignment from column definition
 * @param {string} colDef - Column definition from separator row
 * @returns {string|null} Alignment (left, center, right) or null
 */
function getColumnAlignment(colDef) {
  if (!colDef) return null;
  const trimmed = colDef.trim();
  if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center";
  if (trimmed.endsWith(":")) return "right";
  if (trimmed.startsWith(":")) return "left";
  return null;
}

/**
 * Parse table row content
 * @param {Array} row - Row cells (objects with { text, tokens } in marked v11+)
 * @param {boolean} isHeader - Whether this is a header row
 * @param {Array} alignments - Column alignments
 * @param {Object} schema - ProseMirror schema
 * @returns {Object} Table row node
 */
function parseTableRow(row, isHeader, alignments, schema) {
  return {
    type: "tableRow",
    content: row.map((cell, index) => {
      // In marked v11+, cells are objects with { text, tokens }
      // Use the pre-parsed tokens array directly
      const tokens = cell.tokens || [];

      return {
        type: "tableCell",
        attrs: {
          colspan: 1,
          rowspan: 1,
          align: alignments[index] || null,
          header: isHeader,
        },
        content: [
          {
            type: "paragraph",
            content: tokens.flatMap((t) => parseInline(t, schema)),
          },
        ],
      };
    }),
  };
}

/**
 * Parse table block
 * @param {Object} token - Table token
 * @param {Object} schema - ProseMirror schema
 * @returns {Object} ProseMirror table node
 */
function parseTable(token, schema) {
  // Extract alignments from separator row
  const alignments = token.align || [];

  // Build rows
  const headerRow = parseTableRow(token.header, true, alignments, schema);
  const bodyRows = token.rows.map((row) =>
    parseTableRow(row, false, alignments, schema)
  );

  return {
    type: "table",
    content: [headerRow, ...bodyRows],
  };
}

/** `:` at the start of a paragraph, then a space, a `{` or nothing — Pandoc's caption mark. */
const CAPTION_LEAD = /^:(?=[ \t{]|$)[ \t]*/;

/**
 * A table's caption line — Pandoc's spelling: the paragraph after a table that
 * starts with `:`.
 *
 *     : Plans and prices {placement=wide #tbl-plans}
 *
 * Read strictly, since the line is otherwise an ordinary paragraph:
 *   - `:` and then a space or `{` — not Pandoc's longer `Table:`.
 *   - after the table, as a paragraph of its own. A line directly under a
 *     table's rows is another row in GFM, so a blank line comes first.
 *   - its trailing block holds `placement=…` and `#id` and nothing else
 *     (`trailingBlock`).
 *   - the caption is plain text, as an image's is (`captionText`).
 *
 * @param {Object|undefined} token - the marked token that follows a table
 * @param {Object} schema - ProseMirror schema
 * @returns {Object|null} the table's attributes — `caption`, `id`,
 *   `placement`, each when present — or null when the token is no caption line
 */
function readCaptionLine(token, schema) {
  if (token?.type !== "paragraph") return null;
  const text = String(token.text ?? "");
  const lead = CAPTION_LEAD.exec(text);
  if (!lead) return null;

  const source = text.slice(lead[0].length);
  const block = trailingBlock(source);
  const caption = captionText(block ? block.before : source, schema);
  if (!block && !caption) return null;

  const placement = readPlacement(block?.placement, "table");
  return {
    ...(caption && { caption }),
    ...(block?.id && { id: block.id }),
    ...(placement && { placement }),
  };
}

/**
 * The `{…}` that ends a caption line, when it holds only `placement=…` and
 * `#id`, in either order. Anything else in braces is caption text, so a Loom
 * placeholder stays where the author put it (`: Revenue by {year}`) — the
 * hazard `extractTrailingHeadingAttrs` records for a heading. A brace written
 * `\{` is the author asking for the character, and opens no block.
 *
 * @param {string} source - the caption line after its `:`
 * @returns {{ before: string, id?: string, placement?: string }|null}
 */
function trailingBlock(source) {
  const m = /(^|[^\\])\{([^{}]*)\}[ \t]*$/.exec(source);
  if (!m) return null;
  const parts = m[2].trim().split(/[ \t]+/).filter(Boolean);
  if (parts.length === 0) return null;

  const found = {};
  for (const part of parts) {
    const id = /^#([A-Za-z_][\w-]*)$/.exec(part);
    if (id && found.id === undefined) {
      found.id = id[1];
      continue;
    }
    const placement = /^placement=(?:"([^"]*)"|'([^']*)'|([^\s"']+))$/.exec(part);
    if (placement && found.placement === undefined) {
      found.placement = placement[1] ?? placement[2] ?? placement[3];
      continue;
    }
    return null;
  }
  const before = source.slice(0, m.index + m[1].length).replace(/[ \t]+$/, "");
  return { before, ...found };
}

/**
 * A caption's words — plain text, as an image's caption is. Formatting in it,
 * and anything that is not text, is left out and the author told; the words
 * are kept, with each run of whitespace one space.
 *
 * @param {string} source - the caption, as written
 * @param {Object} schema - ProseMirror schema
 * @returns {string|null}
 */
function captionText(source, schema) {
  if (!source.trim()) return null;
  const nodes = marked.Lexer.lexInline(source, marked.defaults).flatMap((t) => parseInline(t, schema));
  let text = "";
  let formatted = false;
  for (const node of nodes) {
    if (node.type === "text") {
      text += node.text;
      if (node.marks?.length) formatted = true;
    } else if (node.type === "hardBreak") {
      text += " ";
    } else {
      formatted = true;
    }
  }
  if (formatted) {
    warn(`A table's caption is plain text, so the formatting in \`: ${source.trim()}\` is left out — its words are kept`);
  }
  return text.replace(/\s+/g, " ").trim() || null;
}

export { parseTable, readCaptionLine };
