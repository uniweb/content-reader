/**
 * Pretitle (label line) block extension — `#> Text`.
 *
 * A label line names the block that starts next: the small line some designs
 * show above a title (the pretitle, a.k.a. eyebrow or kicker), or the label of
 * an untitled block. On the wire it is an ordinary heading carrying
 * `role: "pretitle"` — an attribute on the existing node, not a new type — so
 * every consumer that already understands headings keeps working.
 *
 *     #> New in v2        → heading { level: 1, role: "pretitle" }
 *     ##> New in v2       → heading { level: 2, role: "pretitle" }
 *
 * The number of leading `#`s is accepted and MEANS NOTHING — a label takes its
 * meaning from its position, never from a size. Leniency is deliberate, the
 * same trade the attribute parser makes for `:` and `,`: an author whose item
 * titles are `##` will reflexively type `##>` for the item's label, and under
 * a strict single-`#` rule that line would degrade to a literal paragraph,
 * silently. The authored count is kept in `level` purely so serialization can
 * round-trip the file byte-for-byte; semantics ignore it.
 *
 * CommonMark is untouched: an ATX heading requires whitespace after its `#`
 * run, so `#>` never matches marked's own heading tokenizer, and without this
 * extension it parses as a literal paragraph. Seven or more `#`s fall through
 * to that paragraph, mirroring the six-level bound on headings.
 */

// `#`×1–6 then `>`, then non-empty text on the same line. A bare `#>` with no
// text stays a paragraph — there is nothing to label with.
const PRETITLE_LINE = /^ {0,3}(#{1,6})>[ \t]*([^\n]*[^\s])[ \t]*(?:\n|$)/

export function createPretitleExtension() {
  return {
    name: 'pretitleBlock',
    level: 'block',
    // Full-pattern pre-filter, per the divider extension's warning: returning
    // 0 on a cheap prefix match tells marked a block may begin here and can
    // split a paragraph mid-flow.
    start(src) {
      return PRETITLE_LINE.test(src) ? 0 : undefined
    },
    tokenizer(src) {
      const m = PRETITLE_LINE.exec(src)
      if (!m) return
      const token = {
        type: 'pretitleBlock',
        raw: m[0],
        level: m[1].length,
        text: m[2],
        tokens: []
      }
      this.lexer.inline(m[2], token.tokens)
      return token
    }
  }
}

export default createPretitleExtension
