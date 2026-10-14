import { readFileSync } from 'node:fs'
import { markdownToProseMirror } from '../src/index.js'
import { getBaseSchema } from '../src/schema/index.js'
import { outsideVocabulary, richTextVocabulary } from '../src/vocabulary.js'
import { CORPUS } from './corpus.js'

/**
 * The vocabulary — what a stored document may hold — and the check against it.
 *
 * Two halves. What the reader writes is within the vocabulary, construct by
 * construct, so a check at write never refuses content the reader produced
 * (except where the author wrote something a page cannot use, named below).
 * And each rule refuses what it exists to refuse: a value that would put a
 * script, a handler or a foreign load on a page.
 */

const paragraph = (...content) => ({ type: 'doc', content: [{ type: 'paragraph', content }] })
const text = (t, marks) => ({ type: 'text', text: t, ...(marks ? { marks } : {}) })
const rules = (doc) => outsideVocabulary(doc).map((f) => `${f.rule} ${f.path}`)

describe('what the reader writes is within the vocabulary', () => {
  // The two the author wrote and a page cannot use: a dotted name is inert —
  // `{.lead}` is the retired class shorthand, and the reader keeps the dot so
  // it cannot switch on a param named `lead` — and a `javascript:` link is
  // never followed. A check at write names both.
  const AUTHORED_OUTSIDE = {
    spanWithClassAndKey: ['style-name /content/0/content/1/marks/0/attrs/.lead'],
  }

  test.each(Object.entries(CORPUS))('%s', (name, md) => {
    expect(rules(markdownToProseMirror(md))).toEqual(AUTHORED_OUTSIDE[name] ?? [])
  })

  test('the reader’s own sample document', () => {
    const md = readFileSync(new URL('./sample.md', import.meta.url), 'utf8')
    expect(rules(markdownToProseMirror(md))).toEqual([])
  })

  test('a link the author wrote with a script URL is named', () => {
    expect(rules(markdownToProseMirror('[x](javascript:alert(1))'))).toEqual([
      'url /content/0/content/0/marks/0/attrs/href',
    ])
  })
})

describe('each rule refuses what it exists to refuse', () => {
  test('a type outside the vocabulary', () => {
    expect(rules({ type: 'doc', content: [{ type: 'ImageBlock', attrs: { src: '/a.png' } }] })).toEqual([
      'node-type /content/0',
    ])
    expect(rules(paragraph(text('x', [{ type: 'textStyle', attrs: { color: 'accent' } }])))).toEqual([
      'mark-type /content/0/content/0/marks/0',
    ])
  })

  test('an attribute a closed type does not declare; an open type takes any', () => {
    expect(rules({ type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'center' } }] })).toEqual([
      'attribute /content/0/attrs/textAlign',
    ])
    expect(rules({ type: 'doc', content: [{ type: 'image', attrs: { src: '/a.svg', svg: '<svg/>' } }] })).toEqual([
      'attribute /content/0/attrs/svg',
    ])
    expect(rules({ type: 'doc', content: [{ type: 'inset_block', attrs: { component: 'Callout', anything: 1 } }] })).toEqual([])
  })

  test('a URL a page would follow or load', () => {
    const link = (href) => paragraph(text('x', [{ type: 'link', attrs: { href } }]))
    expect(rules(link('javascript:alert(1)'))).toEqual(['url /content/0/content/0/marks/0/attrs/href'])
    expect(rules(link(' java\tscript:alert(1)'))).toEqual(['url /content/0/content/0/marks/0/attrs/href'])
    expect(rules(link('data:text/html,<script>alert(1)</script>'))).toEqual(['url /content/0/content/0/marks/0/attrs/href'])
    for (const ok of ['/a', 'about', '#top', 'https://x.test', 'mailto:a@x.test', 'tel:+1', 'page:93dc5359', 'topic:intro']) {
      expect(rules(link(ok))).toEqual([])
    }
    const image = (attrs) => ({ type: 'doc', content: [{ type: 'image', attrs: { src: '/a.png', ...attrs } }] })
    expect(rules(image({ src: 'javascript:alert(1)', poster: 'vbscript:x', href: 'data:text/html,x' }))).toEqual([
      'url /content/0/attrs/src',
      'url /content/0/attrs/poster',
      'url /content/0/attrs/href',
    ])
    expect(rules(paragraph(text('Go', [{ type: 'button', attrs: { href: 'javascript:x', variant: 'primary' } }])))).toEqual([
      'url /content/0/content/0/marks/0/attrs/href',
    ])
  })

  test('a target outside the four keywords', () => {
    expect(rules(paragraph(text('x', [{ type: 'link', attrs: { href: '/a', target: 'top" onclick="y' } }])))).toEqual([
      'target /content/0/content/0/marks/0/attrs/target',
    ])
    expect(rules(paragraph(text('x', [{ type: 'link', attrs: { href: '/a', target: '_blank' } }])))).toEqual([])
  })

  test('a span: style names, and colours', () => {
    const span = (attrs) => paragraph(text('x', [{ type: 'span', attrs }]))
    expect(rules(span({ accent: true, bigRed: true, class: 'lead', id: 'x', color: 'var(--accent)', bg: '#fff' }))).toEqual([])
    expect(rules(span({ onmouseover: 'alert(1)', 'rgb(255, 0, 0)': true, style: 'x', color: 'red;background:url(x)' }))).toEqual([
      'style-name /content/0/content/0/marks/0/attrs/onmouseover',
      'style-name /content/0/content/0/marks/0/attrs/rgb(255, 0, 0)',
      'style-name /content/0/content/0/marks/0/attrs/style',
      'color /content/0/content/0/marks/0/attrs/color',
    ])
  })

  test('MathML outside the allowlist; the reader’s own within it', () => {
    const own = markdownToProseMirror('Euler $e^{i\\pi}+1=0$.\n\n$$\n\\int_0^1 x\\,dx\n$$\n')
    expect(rules(own)).toEqual([])
    const math = (mathml) => ({ type: 'doc', content: [{ type: 'math_display', attrs: { latex: 'x', mathml } }] })
    const findings = outsideVocabulary(math('<math><mi onclick="alert(1)">x</mi><mtext><img src=x onerror=alert(1)></mtext></math>'))
    expect(findings).toEqual([
      { path: '/content/0/attrs/mathml', rule: 'mathml', found: 'attribute mi onclick, element img' },
    ])
  })

  test('a placeholder’s reference is an identifier', () => {
    const placeholder = (refId) => ({ type: 'doc', content: [{ type: 'inset_placeholder', attrs: { refId } }] })
    expect(rules(placeholder('inset_0'))).toEqual([])
    expect(rules(placeholder('x" onload="y'))).toEqual(['ref-id /content/0/attrs/refId'])
  })

  test('a document that is not one', () => {
    expect(rules('<p>hi</p>')).toEqual(['shape '])
    expect(rules({ type: 'paragraph' })).toEqual(['shape '])
    expect(rules({ type: 'doc', content: [{ text: 'x' }, { type: 'text' }, { type: 'paragraph', content: 'x' }] })).toEqual([
      'shape /content/0',
      'shape /content/1/text',
      'shape /content/2/content',
    ])
    expect(outsideVocabulary(null)).toEqual([])
  })

  test('text is never checked', () => {
    expect(rules(paragraph(text('a <img src=x onerror=alert(1)> b, if a<b, R&D')))).toEqual([])
  })

  test('a path escapes `/` and `~` in a key', () => {
    expect(outsideVocabulary(paragraph(text('x', [{ type: 'span', attrs: { 'a/b~c': true } }])))[0].path).toBe(
      '/content/0/content/0/marks/0/attrs/a~1b~0c',
    )
  })
})

describe('the vocabulary as data', () => {
  test('is JSON, and its types are the schema’s', () => {
    const vocabulary = richTextVocabulary()
    expect(JSON.parse(JSON.stringify(vocabulary))).toEqual(vocabulary)
    const { nodes, marks } = getBaseSchema()
    expect(Object.keys(vocabulary.nodes)).toEqual(Object.keys(nodes))
    expect(Object.keys(vocabulary.marks)).toEqual(Object.keys(marks))
    expect(vocabulary.marks.span.open).toBe(true)
    expect(vocabulary.nodes.image.attributes).toEqual(Object.keys(nodes.image.attrs))
  })

  test('names a rule for every value the check reads', () => {
    expect(Object.keys(richTextVocabulary().rules)).toEqual([
      'shape', 'node-type', 'mark-type', 'attribute', 'url', 'target', 'style-name', 'color', 'mathml', 'ref-id',
    ])
  })
})
