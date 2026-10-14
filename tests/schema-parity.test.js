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
 * `inset_placeholder` is produced downstream — by `@uniweb/core` when it lifts
 * insets at render (by @uniweb/build's collector until 2026-09-27) — and some
 * declared types are reachable only through
 * syntax this corpus doesn't cover. Declared-but-unreached is inert;
 * emitted-but-undeclared is the failure that bites.
 *
 * ADDING A NODE OR MARK: add the syntax that produces it to CORPUS below and
 * declare it in src/schema/index.js. If this test fails, the fix is almost
 * always the declaration — not an exclusion here.
 */

import { readFileSync } from 'node:fs'
import { markdownToProseMirror } from '../src/index.js'
import { getBaseSchema } from '../src/schema/index.js'
import { ASSET_SLOTS } from '@uniweb/semantic-parser'

import { CORPUS } from './corpus.js'

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
  // the frontend lane, who read the declared attr
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

  // ── The corpus bound, closed ────────────────────────────────────────────
  //
  // Every test above this line is bounded by CORPUS: coverage is
  // `emitted-by-CORPUS ⊆ declared`, so an attribute no entry happens to write
  // is invisible. That bound has now produced three escapes (`span`;
  // `hardBreak`/`dataBlock`; `size`/`color`), each found by a consumer rather
  // than here — and the third had been a documented authoring spelling for
  // months. A guard that needs its author to imagine the missing case is the
  // same guard that missed it.
  //
  // So this one does not read the corpus. It reads the EMISSION SITE: the
  // attribute names `parseInline` destructures out of `token.attrs` are, by
  // construction, exactly the vocabulary the parser can put on an image node.
  // Adding one without declaring it now fails here whether or not anyone
  // thinks to write markdown that exercises it.
  //
  // Source-text extraction is deliberate. Importing cannot see a destructuring
  // pattern, and every alternative that could (a shared ATTRS constant the
  // parser and schema both consume) makes the two agree by definition — which
  // is not a check, it is a rename. The test's job is to compare two
  // independently-written statements of the same set.
  test('every attribute the PARSER destructures is declared on the image node', () => {
    const inlineSrc = readFileSync(new URL('../src/parser/inline.js', import.meta.url), 'utf8')

    // `parseInline` destructures `token.attrs` for several node types. The one
    // that matters is the LAST such block before the image node is built —
    // anchoring on the emission rather than on a name keeps this pointed at the
    // right code if the variables are renamed.
    const emitAt = inlineSrc.lastIndexOf('type: "image"')
    const blocks = [...inlineSrc.slice(0, emitAt).matchAll(/const\s*\{([\s\S]*?)\}\s*=\s*token\.attrs/g)]
    // Guard the guard: if the destructuring is refactored out of recognition,
    // fail loudly here rather than passing on an empty set.
    expect(emitAt).toBeGreaterThan(0)
    expect(blocks.length).toBeGreaterThan(0)

    const destructured = blocks[blocks.length - 1][1]
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .split(',')
      .map((s) => s.trim().split(':')[0].trim())
      .filter((s) => s && !s.startsWith('...'))

    expect(destructured.length).toBeGreaterThan(15)

    const declared = new Set(Object.keys(schema.nodes.image.attrs))
    expect(destructured.filter((a) => !declared.has(a))).toEqual([])
  })

  // The same guard for a link and a button: the keys of the `attrs` object the
  // parser builds for the mark, read from that code. `isButton && { variant }`
  // is a button's alone; every other key is written on both.
  test('every attribute the PARSER writes on a link or a button is declared', () => {
    const inlineSrc = readFileSync(new URL('../src/parser/inline.js', import.meta.url), 'utf8')
    const at = inlineSrc.indexOf('const linkMark = {')
    expect(at).toBeGreaterThan(0)
    const block = inlineSrc.slice(at, inlineSrc.indexOf('\n        };', at))

    const both = new Set()
    const buttonOnly = new Set()
    for (const line of block.split('\n').map((l) => l.trim())) {
      const spread = line.match(/^\.\.\.\(\s*(.+?)\s*&&\s*\{\s*([A-Za-z]+)/)
      if (spread) (spread[1] === 'isButton' ? buttonOnly : both).add(spread[2])
      else {
        const direct = line.match(/^([A-Za-z]+)\s*[,:]/)
        if (direct && !['type', 'attrs'].includes(direct[1])) both.add(direct[1])
      }
    }
    // Guard the guard: a refactor the reading no longer recognizes fails here.
    expect([...both]).toEqual(expect.arrayContaining(['href', 'title', 'target', 'class']))
    expect([...buttonOnly]).toEqual(['variant'])

    const declared = (type) => new Set(Object.keys(schema.marks[type].attrs))
    expect([...both].filter((a) => !declared('link').has(a))).toEqual([])
    expect([...both, ...buttonOnly].filter((a) => !declared('button').has(a))).toEqual([])
  })

  // The direct half of the same set: attrs written into the node without going
  // through that destructuring (from the href, the title slot, or `otherAttrs`).
  test.each(['src', 'caption', 'alt', 'role', 'library', 'name', 'class', 'id'])(
    'image.%s — emitted directly by the parser — stays declared',
    (attr) => {
      expect(Object.keys(schema.nodes.image.attrs)).toContain(attr)
    }
  )

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

// ─── Asset-slot declaration ───────────────────────────────────────────────────
//
// ⭐ This closes framework's HALF of a gap that has no cross-repo check at all.
//
// The corpus above is driven by MARKDOWN, so it can only see attrs the markdown
// parser emits. Asset identity attrs arrive from the editor and the wire — no
// syntax produces them — so the sweep is blind to them by construction, and the
// app's own fixture cannot help either (it scopes to node types declared on both
// sides *by the same name*, and the editor declares `ImageBlock` where this
// package declares `image`).
//
// What IS checkable here, and what actually went wrong: `ASSET_SLOTS` is the one
// definition of which identity attrs exist, and every one of them has to be
// declared on this node — or it renders fine and is silently dropped by anything
// that validates against this schema. That is precisely how `assetId`/`assetExt`
// nearly shipped undeclared, and it needs no knowledge of the editor's dialect.
describe('asset identity attrs are declared', () => {
  test('every ASSET_SLOTS attr is declared on the image node', () => {
    const declared = new Set(Object.keys(getBaseSchema().nodes.image.attrs))
    const missing = ASSET_SLOTS.flatMap((s) =>
      [s.id, s.ext].filter((a) => !declared.has(a))
    )
    expect(missing).toEqual([])
  })

  test("every slot's URL attrs are declared too", () => {
    // A slot naming an attr this node does not have is a slot nothing can fill.
    const declared = new Set(Object.keys(getBaseSchema().nodes.image.attrs))
    const missing = ASSET_SLOTS.flatMap((s) =>
      s.urls.filter((u) => u !== 'url' && !declared.has(u))
    )
    expect(missing).toEqual([])
  })

  test('CONTROL: the check can see a missing attr', () => {
    // Guards the guard — without this, both assertions above would pass against
    // an empty slot list or an all-declaring schema.
    const declared = new Set(['assetId'])
    const missing = [{ id: 'assetId', ext: 'assetExt' }].flatMap((s) =>
      [s.id, s.ext].filter((a) => !declared.has(a))
    )
    expect(missing).toEqual(['assetExt'])
  })
})

describe('schema parity: each node holds what its `content` declares', () => {
  // ⭐ Emitted ⊆ declared, one level down: the children the parser puts in a node
  // must fit that node's declared `content`, and a `+` must never come out empty.
  // An editor derives where a node may sit from these expressions, so a wrong one
  // misplaces content without an error. ⛔ Nothing checked them until 2026-09-28,
  // and five described a TipTap editor rather than this parser: `blockquote` said
  // `inline*` (it holds blocks), `listItem` `paragraph block*` (it may open with
  // code or a quote), and `doc`, `inset_block` and `concept_block` said `block+`
  // (each can come out empty).
  const schema = getBaseSchema()

  // A node that declares no group is placed both ways by the parser — `image`,
  // `inset_ref` — so it fits a `block` term and an `inline` one.
  const fits = (child, term) => {
    if (child === term) return true
    const group = schema.nodes[child]?.group
    return group === undefined ? term === 'block' || term === 'inline' : group.split(' ').includes(term)
  }

  test('every declared content expression is one term with `*` or `+`', () => {
    // What the check below can read. A richer expression needs a richer check,
    // not a skipped node.
    for (const [type, def] of Object.entries(schema.nodes)) {
      if (def.content !== undefined) expect(def.content, type).toMatch(/^\w+[*+]$/)
    }
  })

  test('every child fits its parent, and no `+` node comes out empty', () => {
    const wrong = []
    for (const [name, md] of Object.entries(CORPUS)) {
      const visit = (n) => {
        const expr = schema.nodes[n.type]?.content
        const kids = n.content || []
        if (expr) {
          const term = expr.slice(0, -1)
          for (const k of kids) {
            if (!fits(k.type, term)) wrong.push(`${n.type} (${expr}) holds ${k.type} — CORPUS.${name}`)
          }
          if (expr.endsWith('+') && kids.length === 0) wrong.push(`${n.type} (${expr}) is empty — CORPUS.${name}`)
        }
        kids.forEach(visit)
      }
      visit(markdownToProseMirror(md))
    }
    expect(wrong).toEqual([])
  })
})
