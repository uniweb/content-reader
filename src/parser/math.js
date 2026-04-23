/**
 * @fileoverview Marked extensions for LaTeX math syntax.
 *
 * Recognises three forms (Pandoc / GitHub / VS Code / Jupyter / Obsidian):
 *   $x^2$              → inline math
 *   $$ ... $$          → display math (block when on its own line,
 *                        inline display when mid-paragraph)
 *   ```math ... ```    → fenced display math (handled in block.js, not here,
 *                        because marked's built-in code fencer captures it)
 *
 * Each tokenizer calls `latexToMathML()` and attaches `latex` + `mathml`
 * to the token. The per-token MathML is what rides through the content
 * pipeline into kit's HTML renderers at runtime.
 *
 * Pandoc disambiguation rules for `$...$`:
 *   1. Body does not begin or end with whitespace.
 *   2. Closing `$` is not immediately followed by a digit
 *      (so `It costs $5 and $10` stays prose).
 *   3. `\$` is a literal dollar sign — handled by marked's built-in
 *      escape tokenizer, which consumes `\$` before this extension runs.
 */

import { latexToMathML } from '../math/index.js'

// Block display: $$...$$ spanning one or more lines, terminated by a newline
// or end-of-input. marked's block lexer calls this against the remaining
// source starting at the current block boundary.
const BLOCK_DISPLAY = /^\$\$([\s\S]+?)\$\$(?:\s*\n|\s*$)/

// Inline display: $$...$$ within a paragraph, no newlines in body.
const INLINE_DISPLAY = /^\$\$([^$\n]+?)\$\$/

// Inline math: $X$ with Pandoc disambiguation — no whitespace adjacent to
// delimiters, body does not span lines, and the closing $ is not followed
// by a digit. Lookaheads/lookbehinds encode rules 1–2; backslash-escape
// handling (rule 3) is delegated to marked's built-in escape tokenizer.
const INLINE_MATH = /^\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/

export function createBlockMathExtension() {
  return {
    name: 'mathBlock',
    level: 'block',
    // Only signal a block match when $$ opens a block (position 0 of the
    // remaining source). Returning a mid-source index here would make
    // marked's block lexer treat the $$ as a block boundary and split a
    // paragraph that happens to contain inline $$...$$.
    start(src) {
      return src.startsWith('$$') ? 0 : undefined
    },
    tokenizer(src) {
      if (!src.startsWith('$$')) return
      const m = BLOCK_DISPLAY.exec(src)
      if (!m) return
      const latex = m[1].trim()
      return {
        type: 'mathBlock',
        raw: m[0],
        latex,
        mathml: latexToMathML(latex, { display: true }),
      }
    },
  }
}

export function createInlineDisplayMathExtension() {
  return {
    name: 'mathInlineDisplay',
    level: 'inline',
    start(src) {
      const idx = src.indexOf('$$')
      return idx < 0 ? undefined : idx
    },
    tokenizer(src) {
      const m = INLINE_DISPLAY.exec(src)
      if (!m) return
      const latex = m[1].trim()
      return {
        type: 'mathInlineDisplay',
        raw: m[0],
        latex,
        mathml: latexToMathML(latex, { display: true }),
      }
    },
  }
}

export function createInlineMathExtension() {
  return {
    name: 'mathInline',
    level: 'inline',
    start(src) {
      const idx = src.indexOf('$')
      return idx < 0 ? undefined : idx
    },
    tokenizer(src) {
      // Don't fire on `$$` — that belongs to the inline-display extension.
      if (src.startsWith('$$')) return
      const m = INLINE_MATH.exec(src)
      if (!m) return
      const latex = m[1]
      return {
        type: 'mathInline',
        raw: m[0],
        latex,
        mathml: latexToMathML(latex, { display: false }),
      }
    },
  }
}

/**
 * All math-related marked extensions, in registration order.
 * Order matters: block before inline; inline-display before inline `$`
 * so `$$x$$` mid-paragraph is recognised as display, not two failed
 * inline matches.
 */
export function getMathExtensions() {
  return [
    createBlockMathExtension(),
    createInlineDisplayMathExtension(),
    createInlineMathExtension(),
  ]
}
