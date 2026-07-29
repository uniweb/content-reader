/**
 * Divider block extension — a thematic break carrying an attribute block.
 *
 * `divider` has a live `type` attribute (kit's renderer switches on `hr` vs
 * `dots`), but until now no markdown spelling could set it: `---`, `***` and
 * `___` all produce the same node, so a file author could not write a dots
 * divider at all. That is not an exotic gap — the visual editor's divider
 * DEFAULTS to dots, so it describes most editor-authored dividers, every one of
 * which degraded to a plain rule on the way through a file.
 *
 *     ---{type=dots}      → divider { type: "dots" }
 *     ***{type=dots}      → same; all three break spellings accept the block
 *     ---                 → untouched: marked's own `hr`, as before
 *
 * DELIBERATELY NOT overloading the existing spellings. Making `***` mean "dots"
 * would have cost no tokenizer at all — the raw token is right there — and it is
 * the wrong trade: CommonMark defines the three as identical, authors type them
 * interchangeably as a house style, and a document's rendering would start
 * depending on a choice writers reasonably consider free. A visible attribute is
 * the framework's existing way to say something extra (`## H {#id}`,
 * `![](x){role=icon}`), and it is the one that cannot surprise anyone.
 *
 * Strictly additive: the tokenizer matches ONLY when an attribute block follows,
 * so every existing divider keeps taking marked's path and no stored content
 * changes meaning.
 */

import { parseAttributeString as parseAttributes } from './attributes.js'

// A thematic break (3+ of -, * or _, optionally spaced) followed on the SAME
// line by an attribute block. Anchored at position 0 — this runs as a block
// tokenizer, so a mid-source match would split a paragraph.
const BREAK_WITH_ATTRS = /^ {0,3}((?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})\{([^}\n]*)\}[ \t]*(?:\n|$)/

export function createDividerExtension() {
  return {
    name: 'dividerBlock',
    level: 'block',
    // Pre-filter on the FULL pattern, not on the leading character.
    //
    // A cheap `/^ {0,3}[-*_]/` looks equivalent and is not: `*` and `_` open
    // emphasis and `-` opens list items, so it returns 0 for a large share of
    // ordinary prose. Returning 0 tells marked's block lexer a block may begin
    // here, and it splits the paragraph — which broke emphasis inside link
    // labels and nested formatting the moment it was tried. The math block
    // carries a comment about exactly this hazard; the pre-filter is where it
    // bites, not the tokenizer.
    start(src) {
      return BREAK_WITH_ATTRS.test(src) ? 0 : undefined
    },
    tokenizer(src) {
      const m = BREAK_WITH_ATTRS.exec(src)
      if (!m) return // no attribute block → leave it to marked's `hr`
      const attrs = m[2] ? parseAttributes(m[2]) : null
      if (!attrs || Object.keys(attrs).length === 0) return // `---{}` is just a rule
      return {
        type: 'dividerBlock',
        raw: m[0],
        attrs
      }
    }
  }
}

export default createDividerExtension
