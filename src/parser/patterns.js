/**
 * @fileoverview Pattern detection for markdown structures
 */

import { parseInline } from "./inline.js";

/**
 * Check if tokens represent an eyebrow pattern
 * @param {Array} tokens - Array of tokens
 * @param {number} index - Current token index
 * @returns {boolean}
 */
function isEyebrowPattern(tokens, index) {
  return (
    tokens[index]?.type === "heading" &&
    tokens[index]?.depth === 3 &&
    tokens[index + 1]?.type === "heading" &&
    tokens[index + 1]?.depth === 1
  );
}

/**
 * Parse eyebrow heading pattern
 * @param {Array} tokens - Array of tokens
 * @param {number} index - Current token index
 * @param {Object} schema - ProseMirror schema
 * @returns {Array} Array of ProseMirror nodes
 */
function parseEyebrowPattern(tokens, index, schema) {
  return [
    {
      type: "eyebrowHeading",
      content: tokens[index].tokens.flatMap((t) => parseInline(t, schema)),
    },
    {
      type: "heading",
      attrs: {
        level: 1,
        id: null,
      },
      content: tokens[index + 1].tokens.flatMap((t) => parseInline(t, schema)),
    },
  ];
}

export { isEyebrowPattern, parseEyebrowPattern };
