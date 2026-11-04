/**
 * `markdownBlocks` — markdown as its top-level blocks, each with the text it was read from and the
 * nodes it reads to, so a writer can keep an author's text for each block an edit left alone.
 *
 * It must say exactly what the text says: the pieces put back together are the markdown, and the
 * blocks read one at a time are the document read whole — or it says nothing (null), and the writer
 * writes the whole.
 */
import { markdownBlocks, markdownToProseMirror } from '../src/index.js'

const SAMPLE = [
  '',
  '# Receiving content',
  '',
  'When you write a section type, the `content` prop arrives already parsed: the',
  "author's markdown has been read into named pieces before your component runs.",
  '',
  '',
  '- one',
  '- two',
  '',
  '```js',
  'const x = 1',
  '```',
  '',
  '[docs]: https://example.com/docs',
  '',
  'See the [docs].',
  '',
].join('\n')

describe('markdownBlocks', () => {
  it('⭐ puts back together exactly, and reads to the document whole', () => {
    const split = markdownBlocks(SAMPLE)
    expect(split.head + split.blocks.map((b) => b.text + b.after).join('')).toBe(SAMPLE)
    expect(split.blocks.flatMap((b) => b.nodes)).toEqual(markdownToProseMirror(SAMPLE).content)
  })

  it('keeps a hard-wrapped paragraph as one block of the author\'s lines', () => {
    const para = markdownBlocks(SAMPLE).blocks.find((b) => b.text.startsWith('When you write'))
    expect(para.text.split('\n')).toHaveLength(2)
    expect(para.nodes).toHaveLength(1)
  })

  it('a link reference definition, which the lexer reads as no block, rides between its neighbours', () => {
    const split = markdownBlocks(SAMPLE)
    const before = split.blocks.find((b) => b.after.includes('[docs]: https://example.com/docs'))
    expect(before.text).toBe('```js\nconst x = 1\n```')
  })

  it('says nothing when the blocks read alone are not the document — a table and its caption line', () => {
    const tableWithCaption = '| a | b |\n|---|---|\n| 1 | 2 |\n\nTable: the caption\n'
    const whole = markdownToProseMirror(tableWithCaption)
    const split = markdownBlocks(tableWithCaption)
    // Either it splits and reads to the whole, or it declines: never a split that reads otherwise.
    if (split) expect(split.blocks.flatMap((b) => b.nodes)).toEqual(whole.content)
    else expect(split).toBeNull()
  })
})
