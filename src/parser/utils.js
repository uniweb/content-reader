/**
 * @fileoverview Shared utility functions for parsing
 */

/**
 * Check if content is empty or whitespace-only
 * @param {Array} content - Array of inline content nodes
 * @returns {boolean}
 */
function isEmptyContent(content) {
  if (!content || content.length === 0) return true;

  if (content.length === 1) {
    const node = content[0];
    if (node.type === "text") {
      const text = node.text || "";
      return text.trim() === "";
    }
  }

  return false;
}

export { isEmptyContent };
