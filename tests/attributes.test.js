/**
 * The `{...}` attribute syntax, and the fact that TWO parsers implement it.
 *
 * `parseAttributeString` (attributes.js) serves images, links, spans, cites and
 * container fences. `parseAttributes` (math.js) is a deliberate inline mirror,
 * kept cross-import-free for SSR bundling. A change to one and not the other
 * means a form works on an image and silently does not on a math block — so the
 * last describe() here compares the two functions directly.
 *
 * Most cases probe through a CONTAINER fence rather than an image: the image
 * node builder keeps only an allowlist of attribute names (`![](x.png){foo=bar}`
 * drops `foo` but keeps `role`), which would silently hollow out the cases
 * below. A container passes its attributes through whole.
 */

import { markdownToProseMirror } from '../src/index.js'
import { parseAttributeString } from '../src/parser/attributes.js'
import { parseAttributes as parseAttributesMirror } from '../src/parser/math.js'

/** Attributes as parsed off a container fence, through real markdown. */
const attrs = attrString => {
  const { component, ...rest } = markdownToProseMirror(
    `\`\`\`@Box{${attrString}}\nbody\n\`\`\``
  ).content[0].attrs
  return rest
}

describe('separators', () => {
  it('accepts `=`', () => {
    expect(attrs('width=800')).toEqual({ width: '800' })
  })

  it('accepts `:` as an alias for `=`', () => {
    // Before this, `width:800` did not parse as a pair at all — `width` was
    // skipped (not followed by whitespace) and `800` cannot start a key. The
    // author got a component with no `width` and no diagnostic.
    expect(attrs('width:800')).toEqual({ width: '800' })
  })

  it('reads `:` and `=` identically in one string', () => {
    expect(attrs('role:hero width=800 fit:cover')).toEqual({
      role: 'hero',
      width: '800',
      fit: 'cover',
    })
  })

  it('requires the separator to touch the key', () => {
    // `{note : warning}` must NOT become a pair. Allowing space around the
    // separator makes a pair and two boolean flags indistinguishable, which
    // trades one silent misparse for another.
    expect(attrs('note : warning')).toEqual({ note: true, warning: true })
  })
})

describe('pair separators', () => {
  it('separates on whitespace', () => {
    expect(attrs('a=1 b=2')).toEqual({ a: '1', b: '2' })
  })

  it('separates on a comma', () => {
    // Previously the comma was swallowed into the unquoted value: `{a=1, b=2}`
    // yielded `a: '1,'`. Nothing reported it.
    expect(attrs('a=1, b=2')).toEqual({ a: '1', b: '2' })
  })

  it('separates on a comma with no space', () => {
    expect(attrs('a=1,b=2')).toEqual({ a: '1', b: '2' })
  })

  it('separates boolean flags on a comma', () => {
    expect(attrs('autoplay, muted, loop')).toEqual({
      autoplay: true,
      muted: true,
      loop: true,
    })
  })

  it('mixes both separators and both assignment forms', () => {
    expect(attrs('type:warning, open flag #x')).toEqual({
      type: 'warning',
      open: true,
      flag: true,
      id: 'x',
    })
  })
})

describe('values that contain a separator character', () => {
  it('keeps a colon inside a value — only the FIRST one separates', () => {
    // The case that makes `:` safe to accept: values legitimately hold colons
    // (URLs, CSS declarations, times).
    expect(attrs('href=https://example.com/a')).toEqual({
      href: 'https://example.com/a',
    })
    expect(attrs('style=color:red')).toEqual({ style: 'color:red' })
    expect(attrs('style:color:red')).toEqual({ style: 'color:red' })
  })

  it('needs quoting for a comma inside a value', () => {
    // The one thing accepting `,` takes away. Nothing in the corpus relied on
    // an unquoted comma inside a value.
    expect(attrs('style="a, b"')).toEqual({ style: 'a, b' })
    expect(attrs("style='a, b'")).toEqual({ style: 'a, b' })
  })
})

describe('the other forms still work', () => {
  it('reads #id, quoted values and boolean flags', () => {
    expect(attrs('#main role="a b" lazy')).toEqual({
      id: 'main',
      role: 'a b',
      lazy: true,
    })
  })
})

describe('there is no class syntax — a leading dot is part of the NAME', () => {
  // `{.featured}` used to mean a CSS class and rendered as class="featured",
  // the one place markdown was taken literally. Now the dot is an ordinary
  // name character, so this is simply the boolean attribute ".featured".
  it('reads a dotted name as one boolean attribute', () => {
    expect(attrs('.featured')).toEqual({ '.featured': true })
  })

  it('keeps the whole chain of a compact dotted name', () => {
    // Stripping the dot would have dropped `one` here. Keeping it is lossless.
    expect(attrs('.one.two')).toEqual({ '.one.two': true })
  })

  it('reads several dotted names as several attributes', () => {
    expect(attrs('.a .b')).toEqual({ '.a': true, '.b': true })
    expect(attrs('.a, .b')).toEqual({ '.a': true, '.b': true })
  })

  it('never produces a `class` attribute', () => {
    expect(attrs('.featured .rounded')).not.toHaveProperty('class')
  })

  it('does NOT collapse a dotted name onto the undotted one', () => {
    // The reason the dot is kept rather than stripped: `{.featured}` must not
    // become `{featured: true}`, which would silently ACTIVATE a foundation's
    // declared boolean param named `featured`. A dotted name matches no
    // declared param, so it is inert.
    // NB: assert on key lists, not toHaveProperty — it reads a dot as a
    // nested-path separator, so `toHaveProperty('.featured')` never matches.
    expect(Object.keys(attrs('.featured'))).toEqual(['.featured'])
    expect(Object.keys(attrs('featured'))).toEqual(['featured'])
  })

  it('still takes a value, with the dot part of the key', () => {
    expect(attrs('.featured=yes')).toEqual({ '.featured': 'yes' })
  })
})

describe('the same syntax on an image', () => {
  // Proof the widened parser is reached through a second tokenizer, using
  // names the image builder keeps.
  const imageAttrs = attrString =>
    markdownToProseMirror(`![alt](/x.png){${attrString}}`).content[0].attrs

  it('accepts `:` and commas on an image', () => {
    expect(imageAttrs('role:hero')).toMatchObject({ role: 'hero' })
    expect(imageAttrs('role:hero, fit:cover')).toMatchObject({
      role: 'hero',
      fit: 'cover',
    })
  })
})

describe('the two implementations agree', () => {
  // Compared DIRECTLY rather than through markdown. Going via `$$x^2$$ {...}`
  // would prove nothing: block.js:296 keeps only `id` off a math block's
  // attributes and drops the rest, so every other form would compare equal by
  // being equally absent.
  //
  // Values are word-shaped on purpose — the mirror accepts a narrower unquoted
  // value charset (`[\w-]+`), which predates this change and is not what these
  // cases are about.
  const SHARED = [
    'a=1',
    'a:1',
    'a=1, b=2',
    'a=1,b=2',
    'a:1 b:2',
    'a:1,b:2',
    '#main',
    '.one .two',
    'flag',
    'flag, other',
    '#main .cls a:1, flag',
    '.featured',
    '.one.two',
    'a="x y"',
    'note : warning',
  ]

  it.each(SHARED)('parses `%s` identically in both implementations', attrString => {
    expect(parseAttributesMirror(attrString)).toEqual(parseAttributeString(attrString))
    expect(Object.keys(parseAttributeString(attrString)).length).toBeGreaterThan(0)
  })
})
