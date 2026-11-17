import { describe, it, expect } from 'vitest'
import { markdownToProseMirror } from '../src/index.js'
import { cleanToVocabulary } from '../src/vocabulary.js'

/**
 * ⭐ Underline, superscript and subscript are marks of the vocabulary (2026-11-17), written
 * `[x]{underline}`, `[2]{sup}` and `[2]{sub}`. They mean the same to every reader of a text — a page,
 * a Press document, a file — whatever a site's theme holds, so a CV keeps CO₂ and m² wherever it is
 * read. Any other bracket name is still a style name.
 */
const runs = (md) =>
  markdownToProseMirror(md).content[0].content.map((n) => [n.text, (n.marks || []).map((m) => (m.attrs ? { [m.type]: m.attrs } : m.type))])

describe('a bracket writes a mark of its own', () => {
  it('⭐ underline, sup and sub are the marks, each of the words', () => {
    expect(runs('CO[2]{sub}, m[2]{sup} and [this]{underline}')).toEqual([
      ['CO', []],
      ['2', ['subscript']],
      [', m', []],
      ['2', ['superscript']],
      [' and ', []],
      ['this', ['underline']],
    ])
  })

  it('beside a style name, the mark comes first and the style stays the span\'s', () => {
    expect(runs('[x]{sub accent}')).toEqual([['x', ['subscript', { span: { accent: true } }]]])
  })

  it('⭐ a link holds one: the link reads first, then its text', () => {
    expect(runs('[[2]{sup}](https://x.test)')).toEqual([['2', ['superscript', { link: { href: 'https://x.test', title: null } }]]])
  })

  it('with a value, the name is no mark: it stays the span\'s, which the vocabulary does not keep', () => {
    expect(runs('[x]{sub=1}')).toEqual([['x', [{ span: { sub: '1' } }]]])
    const { removed } = cleanToVocabulary(markdownToProseMirror('[x]{sub=1}'))
    expect(removed.map((r) => r.rule)).toEqual(['style-name'])
  })

  it('⭐ formatting inside a bracket is read, as for any text', () => {
    expect(runs('[**bold** words]{accent}')).toEqual([
      ['bold', ['bold', { span: { accent: true } }]],
      [' words', [{ span: { accent: true } }]],
    ])
    expect(runs('[CO**2**]{underline}')).toEqual([['CO', ['underline']], ['2', ['bold', 'underline']]])
  })

  it('CONTROL — any other name is a style name, as before', () => {
    expect(runs('[x]{accent}')).toEqual([['x', [{ span: { accent: true } }]]])
  })
})

describe('what a stored text keeps of an editor\'s marks', () => {
  const doc = (marks, attrs) => ({ type: 'doc', content: [{ type: 'paragraph', ...(attrs ? { attrs } : {}), content: [{ type: 'text', text: 'x', marks }] }] })

  it('⭐ keeps underline, superscript and subscript', () => {
    const marks = [{ type: 'underline' }, { type: 'superscript' }, { type: 'subscript' }]
    expect(cleanToVocabulary(doc(marks))).toEqual({ document: doc(marks), removed: [] })
  })

  it('leaves out a highlight and an alignment — the theme\'s and the component\'s to give', () => {
    const { document, removed } = cleanToVocabulary(doc([{ type: 'highlight' }, { type: 'bold' }], { textAlign: 'center' }))
    expect(document.content[0].content[0].marks).toEqual([{ type: 'bold' }])
    expect(document.content[0].attrs ?? {}).not.toHaveProperty('textAlign')
    expect(removed.map((r) => r.rule).sort()).toEqual(['attribute', 'mark-type'])
  })
})
