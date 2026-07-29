/**
 * Schema parity — the declared dialect must cover what the parser emits.
 *
 * `getBaseSchema()` is exported as a CONTRACT (src/index.js): a consumer that
 * renders or edits this content generates its own adapter from it. An inventory
 * that can silently fall behind its own parser is worse than no inventory,
 * because it converts "we don't know" into "we checked".
 *
 * That is not hypothetical. In July 2026 the declared schema was missing
 * `span`, `strike` and `inset_block` — `span` since January — so ordinary
 * markdown like `# Ready to [get started]{accent}?` produced a mark no consumer
 * had been told about. A strict consumer that rejects unknown types fails hard
 * on such a document; a lenient one drops the author's markup on load and, in a
 * read-write tool, writes the loss back on the next save.
 *
 * This test walks real parser output rather than grepping for type literals,
 * because the parser also matches on marked's own token names (`mathInline`,
 * `dataBlock`, `warning`, …) which are inputs, not emitted node types — a
 * grep cannot tell the two apart.
 *
 * DIRECTION: emitted ⊆ declared. The converse is deliberately not asserted —
 * `inset_placeholder` is produced downstream by @uniweb/build's
 * content-collector, and some declared types are reachable only through
 * syntax this corpus doesn't cover. Declared-but-unreached is inert;
 * emitted-but-undeclared is the failure that bites.
 *
 * ADDING A NODE OR MARK: add the syntax that produces it to CORPUS below and
 * declare it in src/schema/index.js. If this test fails, the fix is almost
 * always the declaration — not an exclusion here.
 */

import { markdownToProseMirror } from '../src/index.js'
import { getBaseSchema } from '../src/schema/index.js'

// One entry per construct. The key names the syntax so a failure says which
// markdown produced the undeclared type.
const CORPUS = {
  headings: '# H1 heading\n\n## H2 heading\n',
  paragraph: 'A plain paragraph.\n',
  inlineMarks: 'Text **bold** *ital* `code` ~~strike~~ and [link](/a).\n',
  bracketedSpan: '# Ready to [get started]{accent}?\n',
  spanWithClassAndKey: 'A [phrase]{.lead size=lg} here.\n',
  // BOTH spellings, and they must stay literal. A single "\n" here is a SOFT
  // break — it produces no hardBreak node at all, so this entry named the
  // construct while testing something else, and `hardBreak` escaped the
  // inventory undeclared with the suite green. That is the corpus bound in this
  // file's header, fired: coverage is `emitted-by-CORPUS ⊆ declared`, so an
  // entry that does not produce what it is named for silently narrows it.
  hardBreakTwoSpaces: 'line one  \nline two\n',
  hardBreakBackslash: 'line one\\\nline two\n',
  softBreakStaysText: 'line one\nline two\n',
  bulletList: '- a\n- b\n',
  orderedList: '1. one\n2. two\n',
  looseList: '- para one\n\n- para two\n',
  codeBlock: '```js\nconst x = 1\n```\n',
  // A TAGGED fence is a `dataBlock`, not a `codeBlock` — a separate emitted type
  // that escaped the inventory entirely until 2026-07-29 because no corpus entry
  // produced one. Both spellings, since the reader dispatches on the tag.
  dataBlockYaml: '```yaml:Card\ntitle: Hello\n```\n',
  dataBlockJson: '```json:Form\n{ "fields": [] }\n```\n',
  blockquote: '> quoted **text**\n',
  divider: 'before\n\n---\n\nafter\n',
  image: '![alt](/img.png){width=100}\n',
  icon: '![](lu-house)\n',
  insetRefVisual: '![desc](@Gallery){cols=3}\n',
  insetRefText: 'See [the note](@Cite){key=smith2020}.\n',
  insetBlock: '```@Alert{type=warning}\nBody with **marks** and [links](/x).\n```\n',
  mathInline: 'Euler $e^{i\\pi}+1=0$ here.\n',
  mathDisplay: '$$\n\\int_0^1 x\\,dx\n$$\n',
  mathFence: '```math\nE = mc^2\n```\n',
  table: '| a | b |\n|---|---|\n| 1 | 2 |\n',
}

/** Collect every node and mark type in a doc, remembering where it came from. */
function collect(doc, origin, nodes, marks) {
  const visit = (n) => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(visit)
    if (n.type && !nodes.has(n.type)) nodes.set(n.type, origin)
    for (const m of n.marks || []) {
      const t = typeof m === 'string' ? m : m?.type
      if (t && !marks.has(t)) marks.set(t, origin)
    }
    if (n.content) visit(n.content)
  }
  visit(doc)
}

function parseCorpus() {
  const nodes = new Map()
  const marks = new Map()
  for (const [name, md] of Object.entries(CORPUS)) {
    collect(markdownToProseMirror(md), name, nodes, marks)
  }
  return { nodes, marks }
}

describe('schema parity: every emitted type is declared', () => {
  const { nodes, marks } = parseCorpus()
  const schema = getBaseSchema()

  test('the corpus reaches a meaningful share of the dialect', () => {
    // Guards the guard: if the corpus stops parsing, every other assertion
    // here passes vacuously.
    expect(nodes.size).toBeGreaterThan(10)
    expect(marks.size).toBeGreaterThan(3)
  })

  test('every emitted NODE type is declared in getBaseSchema()', () => {
    const declared = new Set(Object.keys(schema.nodes))
    const undeclared = [...nodes.keys()]
      .filter((t) => !declared.has(t))
      .map((t) => `${t} (emitted by CORPUS.${nodes.get(t)})`)
    expect(undeclared).toEqual([])
  })

  test('every emitted MARK type is declared in getBaseSchema()', () => {
    const declared = new Set(Object.keys(schema.marks))
    const undeclared = [...marks.keys()]
      .filter((t) => !declared.has(t))
      .map((t) => `${t} (emitted by CORPUS.${marks.get(t)})`)
    expect(undeclared).toEqual([])
  })

  // Types whose attribute set is INTENTIONALLY open-ended, so an attr sweep
  // must not police them. Each carries author-supplied `{key=value}` names that
  // cannot be enumerated ahead of time — for `span` the attribute NAME is the
  // payload (see src/schema/index.js). Everything else is closed: a new attr
  // there is a declaration someone forgot.
  //
  // DERIVED from the schema's own `openAttrs` marker rather than hardcoded here.
  // A second list is a second thing to forget: a consumer generating an adapter
  // reads the schema, so if this test's notion of "open" and the schema's ever
  // disagreed, the test would be policing a contract nobody publishes. Found by
  // the frontend (channel `frontend-framework-5a47`), who read the declared attr
  // list for `inset_block`, saw only `component`, and correctly asked whether the
  // openness was deliberate or an omission — it was deliberate and unstated.
  const OPEN_ATTR_TYPES = new Set([
    ...Object.entries(schema.nodes).filter(([, def]) => def?.openAttrs).map(([type]) => type),
    ...Object.entries(schema.marks).filter(([, def]) => def?.openAttrs).map(([type]) => type),
  ])

  test('the open-attribute types are declared as such in the schema', () => {
    // Not a tautology: it pins WHICH types are open, so opening a new one is a
    // deliberate edit here rather than a quiet way past the attribute sweep.
    expect([...OPEN_ATTR_TYPES].sort()).toEqual(['inset_block', 'inset_ref', 'span'])
  })

  test('every emitted ATTRIBUTE is declared, for closed types', () => {
    // Types alone are not enough. `image` emitted `library` and `name` — the
    // icon reference from `![](lu-house)` — for months while declaring 17 other
    // attrs, so a consumer generating its schema from this inventory would
    // build a node that silently drops an icon's identity on load. A
    // type-level guard cannot see that; this one can.
    const declaredAttrs = (kind, type) =>
      new Set(Object.keys((kind === 'node' ? schema.nodes : schema.marks)[type]?.attrs || {}))

    const undeclared = []
    for (const [name, md] of Object.entries(CORPUS)) {
      const visit = (n) => {
        if (!n || typeof n !== 'object') return
        if (Array.isArray(n)) return n.forEach(visit)
        if (n.type && n.attrs && !OPEN_ATTR_TYPES.has(n.type)) {
          const dec = declaredAttrs('node', n.type)
          for (const a of Object.keys(n.attrs)) {
            if (!dec.has(a)) undeclared.push(`node ${n.type}.${a} (CORPUS.${name})`)
          }
        }
        for (const m of n.marks || []) {
          if (!m?.attrs || OPEN_ATTR_TYPES.has(m.type)) continue
          const dec = declaredAttrs('mark', m.type)
          for (const a of Object.keys(m.attrs)) {
            if (!dec.has(a)) undeclared.push(`mark ${m.type}.${a} (CORPUS.${name})`)
          }
        }
        if (n.content) visit(n.content)
      }
      visit(markdownToProseMirror(md))
    }
    expect([...new Set(undeclared)]).toEqual([])
  })

  test('an icon keeps its reference — library + name, not a resolved glyph', () => {
    // `![](lu-house)` is a REFERENCE. A consumer that drops these two attrs
    // (or inlines a resolved SVG instead) freezes the glyph and loses the
    // ability to re-theme or re-resolve it — the same failure shape as
    // substituting a resolved colour for a span's attribute name.
    const doc = markdownToProseMirror('![](lu-house)\n')
    const img = doc.content.flatMap((n) => (n.type === 'image' ? [n] : n.content || [])).find((n) => n?.type === 'image')
    expect(img.attrs.role).toBe('icon')
    expect(img.attrs.library).toBe('lu')
    expect(img.attrs.name).toBe('house')
    expect(Object.keys(schema.nodes.image.attrs)).toEqual(expect.arrayContaining(['library', 'name']))
  })

  // The three that were missing when this guard was written. Named explicitly
  // so a regression points at the incident rather than at a bare set diff.
  test.each([
    ['node', 'inset_block'],
    ['mark', 'strike'],
    ['mark', 'span'],
  ])('%s %s stays declared', (kind, type) => {
    const bucket = kind === 'node' ? schema.nodes : schema.marks
    expect(Object.keys(bucket)).toContain(type)
  })

  test('a bracketed span keeps its attribute NAME — the theme binding', () => {
    // theme.yml `inline: { accent: … }` generates `span[accent] { … }`
    // (@uniweb/theming). If the name is dropped or normalised, authored text
    // silently loses its link to the site's theme.
    const doc = markdownToProseMirror('# Ready to [get started]{accent}?')
    const marked = doc.content[0].content.find((n) => n.marks?.length)
    expect(marked.marks[0].type).toBe('span')
    expect(marked.marks[0].attrs).toHaveProperty('accent')
  })
})
