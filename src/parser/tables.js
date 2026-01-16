/**
 * @fileoverview Parse markdown tables
 */

import { parseInline } from "./inline.js";

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

export { parseTable };
