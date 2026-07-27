/**
 * @fileoverview Parse curly brace attributes from markdown
 *
 * Supports syntax like: {role=hero width=1200 #id autoplay}
 *
 * Attribute types:
 * - key=value     → { key: "value" }
 * - key:value     → { key: "value" } (`:` is an accepted alias for `=`)
 * - key="value"   → { key: "value" } (quoted, allows spaces and commas)
 * - key='value'   → { key: "value" } (single quoted)
 * - #idName       → { id: "idName" }
 * - booleanKey    → { booleanKey: true }
 *
 * ## There is no CSS-class syntax — a leading dot is part of the NAME
 *
 * `{.featured}` used to mean a CSS class and produced `class="featured"` in
 * rendered output. It no longer does: a dot is an ordinary name character, so
 * `{.featured}` is the boolean attribute `".featured"` and `{.one.two}` is the
 * boolean attribute `".one.two"`.
 *
 * Author-supplied CSS classes were the one place markdown was taken LITERALLY.
 * Everywhere else the foundation interprets: `#` is not `<h1>`, `**bold**` is
 * not `font-weight:700`, `{accent}` is not a color. `class="featured"` was the
 * exception, and it let content dictate presentation.
 *
 * Nothing is lost, because the better spelling already existed. A bare name is
 * an open, multi-valued author label set that renders as a SEMANTIC attribute —
 * `[x]{accent muted}` → `<span accent="true" muted="true">` — and sites declare
 * what those names mean under `theme.yml`'s `inline:` key. An author who wrote
 * `{.featured}` writes `{featured}`.
 *
 * Keeping the dot IN the name rather than stripping it is deliberate, and the
 * reason is safety, not tidiness: stripping would turn `{.featured}` into
 * `{featured: true}`, which would silently ACTIVATE a foundation's declared
 * boolean param named `featured`. `.featured` matches no declared param, so it
 * is inert. It is also lossless — stripping would drop `one` from `{.one.two}`.
 *
 * It round-trips with no special case on either side: content-writer's plain
 * boolean branch serializes `{".featured": true}` straight back to
 * `{.featured}`.
 *
 * Pairs are separated by whitespace, a comma, or both — `{a=1 b=2}`,
 * `{a=1, b=2}` and `{a=1,b=2}` are the same thing.
 *
 * ## Why `:` and `,` are accepted
 *
 * Not to offer choice — to stop a near-miss from parsing as something else.
 * Both forms are what a reader of YAML, CSS or JSON reaches for by reflex, and
 * before this each one failed SILENTLY rather than loudly:
 *
 *   {type:warning}  →  { warning: true }   `type` was skipped, then `warning`
 *                                          matched the bare-flag branch
 *   {a=1, b=2}      →  { a: "1,", b: "2" } the comma was swallowed into the
 *                                          unquoted value
 *
 * Neither raised anything. An author got a component with the wrong params and
 * no indication why. Widening the accepted syntax is the cheap fix; the
 * alternative — detecting and reporting an unconsumed remainder — is a bigger
 * change to a parser five tokenizers share.
 *
 * The separator is tight ON PURPOSE: `[=:]` must follow the key immediately.
 * Allowing `{note : warning}` would make a pair and two boolean flags
 * indistinguishable, which trades one silent misparse for another.
 *
 * A comma inside a value therefore needs quoting — `{style="a, b"}`. That is
 * the one thing this widening takes away, and nothing in the corpus used it.
 *
 * NOTE: `parseAttributes` in ./math.js is a deliberate inline MIRROR of this
 * function (kept cross-import-free for SSR bundling). Any change to the
 * accepted syntax must be made in both, and `tests/attributes.test.js` pins
 * them to each other.
 */

/**
 * Parse an attribute string like "role=hero width=1200 .featured autoplay"
 *
 * @param {string} attrString - The attribute string (without curly braces)
 * @returns {Object} Parsed attributes object
 */
export function parseAttributeString(attrString) {
  if (!attrString || typeof attrString !== 'string') {
    return {}
  }

  const attrs = {}

  // Regex to match different attribute patterns.
  // Handles: key="value", key='value', key=value, key:value, #id, boolean.
  //
  // A NAME is a plain identifier or a dotted chain (`.featured`, `.one.two`) —
  // the leading dot is part of the name, NOT a class marker (see the header).
  // The same name shape is accepted in both the key and the boolean position.
  //
  // A comma is a pair separator, so it terminates an unquoted value and can
  // follow a boolean flag.
  const pattern =
    /(?:((?:\.[a-zA-Z_][\w-]*)+|[a-zA-Z_][\w-]*)[=:](?:"([^"]*)"|'([^']*)'|([^\s},]+))|#([a-zA-Z_][\w-]*)|((?:\.[a-zA-Z_][\w-]*)+|[a-zA-Z_][\w-]*)(?=[\s,}]|$))/g

  let match
  while ((match = pattern.exec(attrString)) !== null) {
    const [, key, quotedDouble, quotedSingle, unquoted, idName, booleanKey] = match

    if (key) {
      // key=value attribute
      attrs[key] = quotedDouble ?? quotedSingle ?? unquoted
    } else if (idName) {
      // #id
      attrs.id = idName
    } else if (booleanKey) {
      // boolean attribute (no value)
      attrs[booleanKey] = true
    }
  }

  return attrs
}

/**
 * Extract attributes block from the end of a string
 *
 * @param {string} text - Text that may end with {attributes}
 * @returns {{ text: string, attrs: Object }} The text without attrs and parsed attrs
 */
export function extractTrailingAttributes(text) {
  if (!text || typeof text !== 'string') {
    return { text: text || '', attrs: {} }
  }

  // Match {attributes} at the end of the string
  // Handles nested braces in values by matching balanced braces
  const match = text.match(/\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\s*$/)

  if (!match) {
    return { text, attrs: {} }
  }

  const attrString = match[1]
  const textWithoutAttrs = text.slice(0, match.index).trimEnd()

  return {
    text: textWithoutAttrs,
    attrs: parseAttributeString(attrString)
  }
}

/**
 * Check if a string contains an attribute block
 *
 * @param {string} text - Text to check
 * @returns {boolean} True if text contains {attributes}
 */
export function hasAttributes(text) {
  return /\{[^{}]+\}\s*$/.test(text)
}

/**
 * Merge multiple attribute objects, with later objects taking precedence
 *
 * @param  {...Object} attrObjects - Attribute objects to merge
 * @returns {Object} Merged attributes
 */
export function mergeAttributes(...attrObjects) {
  const result = {}
  const allClasses = []

  for (const attrs of attrObjects) {
    if (!attrs) continue

    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'class') {
        // Accumulate classes
        allClasses.push(value)
      } else {
        result[key] = value
      }
    }
  }

  if (allClasses.length > 0) {
    result.class = allClasses.join(' ')
  }

  return result
}

/**
 * Normalize attribute names to camelCase
 *
 * @param {Object} attrs - Attributes with potentially kebab-case keys
 * @returns {Object} Attributes with camelCase keys
 */
export function normalizeAttributeNames(attrs) {
  const result = {}

  for (const [key, value] of Object.entries(attrs)) {
    // Convert kebab-case to camelCase
    const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    result[camelKey] = value
  }

  return result
}
