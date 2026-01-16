/**
 * @fileoverview Marked extensions for enhanced markdown syntax
 *
 * Adds support for curly brace attributes on images and links:
 * - ![alt](src){attrs}
 * - [text](href){attrs}
 */

import { parseAttributeString } from './attributes.js'

/**
 * Regex patterns for matching markdown elements with optional attributes
 */
const PATTERNS = {
  // Image: ![alt](src "title"){attrs}
  // Captures: alt, src, title (optional), attrs (optional)
  image: /^!\[([^\]]*)\]\(([^)"'\s]+)(?:\s+["']([^"']*)["'])?\)(?:\{([^}]*)\})?/,

  // Link: [text](href "title"){attrs}
  // Captures: text, href, title (optional), attrs (optional)
  link: /^\[([^\]]+)\]\(([^)"'\s]+)(?:\s+["']([^"']*)["'])?\)(?:\{([^}]*)\})?/,
}

/**
 * Create a marked extension for images with attribute support
 *
 * @returns {Object} Marked tokenizer extension
 */
export function createImageExtension() {
  return {
    name: 'image',
    level: 'inline',
    start(src) {
      return src.indexOf('![')
    },
    tokenizer(src) {
      const match = PATTERNS.image.exec(src)
      if (!match) return

      const [raw, alt, href, title, attrString] = match

      // Parse attributes from curly braces
      const attrs = attrString ? parseAttributeString(attrString) : {}

      return {
        type: 'image',
        raw,
        text: alt || '',
        href,
        title: title || null,
        attrs, // Extended: parsed attributes
      }
    },
  }
}

/**
 * Create a marked extension for links with attribute support
 *
 * @returns {Object} Marked tokenizer extension
 */
export function createLinkExtension() {
  return {
    name: 'link',
    level: 'inline',
    start(src) {
      // Don't match images (starting with !)
      const idx = src.indexOf('[')
      if (idx > 0 && src[idx - 1] === '!') {
        // Find next [ that's not part of an image
        const nextIdx = src.indexOf('[', idx + 1)
        return nextIdx >= 0 ? nextIdx : -1
      }
      return idx
    },
    tokenizer(src) {
      // Don't match if this is an image
      if (src.startsWith('![')) return

      const match = PATTERNS.link.exec(src)
      if (!match) return

      const [raw, text, href, title, attrString] = match

      // Parse attributes from curly braces
      const attrs = attrString ? parseAttributeString(attrString) : {}

      return {
        type: 'link',
        raw,
        text,
        href,
        title: title || null,
        attrs, // Extended: parsed attributes
        // Include tokens for nested content
        tokens: [],
      }
    },
    childTokens: ['tokens'],
  }
}

/**
 * Get all custom marked extensions
 *
 * @returns {Object} Marked extensions configuration
 */
export function getMarkedExtensions() {
  return {
    extensions: [
      createImageExtension(),
      createLinkExtension(),
    ],
  }
}

export default getMarkedExtensions
