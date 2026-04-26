/**
 * @fileoverview Marked extensions for enhanced markdown syntax
 *
 * Adds support for curly brace attributes on images and links:
 * - ![alt](src){attrs}
 * - [text](href){attrs}
 */

import { parseAttributeString } from './attributes.js'
import { getMathExtensions } from './math.js'

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

  // Span (bracketed span): [text]{attrs}
  // Pandoc-style bracketed spans - text with attributes but no href
  // Captures: text, attrs
  span: /^\[([^\]]+)\]\{([^}]+)\}/,

  // Cite shorthand: [@key]{attrs} or [@a;@b]{attrs}, attrs optional.
  // Captures: keys (the @key list, semicolon-separated), attrs (optional).
  // Sugar for [keys](@Cite){attrs} — inline-textual inset, defaults
  // component to Cite. Bare keys must match [\w-] (no spaces, no
  // formatting); anything richer falls through to the span / link
  // tokenizers.
  cite: /^\[((?:@[\w-]+)(?:\s*;\s*@[\w-]+)*)\](?:\{([^}]*)\})?/,
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
 * Create a marked extension for bracketed spans (Pandoc-style)
 *
 * Syntax: [text]{.class #id key=value}
 *
 * Used for inline text with semantic attributes like:
 * - [highlighted text]{.highlight}
 * - [muted note]{.muted}
 * - [important]{.callout}
 *
 * @returns {Object} Marked tokenizer extension
 */
export function createSpanExtension() {
  return {
    name: 'span',
    level: 'inline',
    start(src) {
      // Find [ but we need to check it's not a link or image
      const idx = src.indexOf('[')
      return idx
    },
    tokenizer(src) {
      // Don't match images or links
      if (src.startsWith('![')) return

      // Cede to the cite tokenizer for `[@<key>](...)` shapes — those
      // are citation references, not generic spans. Marked treats both
      // tokenizers as equally eligible at offset 0, so the span
      // tokenizer has to opt out explicitly.
      if (PATTERNS.cite.test(src)) return

      // Check if this is a link [text](url) - if so, skip
      // We need to match span ONLY if there's no () after ]
      const match = PATTERNS.span.exec(src)
      if (!match) return

      // Make sure this isn't actually a link (check there's no ( after ])
      const bracketEnd = src.indexOf(']')
      if (bracketEnd > 0 && src[bracketEnd + 1] === '(') return

      const [raw, text, attrString] = match

      // Parse attributes from curly braces
      const attrs = parseAttributeString(attrString)

      return {
        type: 'span',
        raw,
        text,
        attrs,
        // Include tokens for nested formatting (bold, italic, etc.)
        tokens: [],
      }
    },
    childTokens: ['tokens'],
  }
}

/**
 * Create a marked extension for the cite shorthand `[@key]` / `[@key]{attrs}`
 * / `[@a;@b]{attrs}`.
 *
 * Sugar for an inline `inset_ref` with `component: 'Cite'` and
 * `embedKind: 'text'`. The keys ride on the inset_ref's `key` attr —
 * semicolon-separated when multi-cite. Locator / label / suppress-author
 * land in the curly-brace attrs and pass through unchanged.
 *
 * Registered BEFORE the span extension so a bare `[@key]{...}` doesn't
 * get tokenized as a generic span. The pattern is strict (`^@<word>`
 * inside the brackets) so regular spans like `[some text]{.note}` still
 * fall through to the span tokenizer.
 *
 * @returns {Object} Marked tokenizer extension
 */
export function createCiteExtension() {
  return {
    name: 'cite',
    level: 'inline',
    start(src) {
      // Match positions of `[@` — the cite shorthand always starts with
      // an open-bracket immediately followed by `@`.
      return src.indexOf('[@')
    },
    tokenizer(src) {
      // Don't match images or links.
      if (src.startsWith('![')) return
      const match = PATTERNS.cite.exec(src)
      if (!match) return
      // Same guard the span tokenizer uses: if there's a `(` immediately
      // after `]`, this is a link, not a cite.
      const bracketEnd = src.indexOf(']')
      if (bracketEnd > 0 && src[bracketEnd + 1] === '(') return
      const [raw, keys, attrString] = match
      const attrs = attrString ? parseAttributeString(attrString) : {}
      return {
        type: 'cite',
        raw,
        text: keys.replace(/\s+/g, ''),
        attrs,
      }
    },
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
      // Cite must run before span — `[@key]{k=v}` is a span-shaped
      // pattern that we want to interpret as a cite, not a generic span.
      createCiteExtension(),
      createSpanExtension(),
      ...getMathExtensions(),
    ],
  }
}

export default getMarkedExtensions
