/**
 * Markdown, one entry per construct the reader turns into a node, a mark or an
 * attribute — the corpus `schema-parity.test.js` and `vocabulary.test.js` walk.
 * The key names the syntax, so a failure says which markdown produced it.
 */

export const CORPUS = {
  headings: '# H1 heading\n\n## H2 heading\n\n#> Label line\n',
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
  // The FALLBACK a tagged fence degrades to when its body does not parse into
  // data — a `codeBlock` that still carries the author's `tag`. Both entries
  // above exit through `dataBlock` instead, so neither reaches this branch, and
  // `codeBlock.tag` sat emitted-but-undeclared behind that gap until 2026-07-30:
  // the corpus bound in this file's header, fired a FOURTH time, and the first
  // where the missing coverage was a construct's failure path rather than the
  // construct itself. Covering a syntax does not cover what it falls back to.
  codeBlockTaggedUnknownLang: '```toml:Config\nkey = 1\n```\n',
  codeBlockTaggedMalformed: '```json:Broken\n{not json\n```\n',
  blockquote: '> quoted **text**\n',
  divider: 'before\n\n---\n\nafter\n',
  image: '![alt](/img.png){width=100}\n',
  icon: '![](lu-house)\n',
  // The icon's two DOCUMENTED optional attrs (cli/partials/agents.md, which
  // ships as AGENTS.md in every project). Both were emitted-but-undeclared
  // until 2026-07-30 because `CORPUS.icon` above is the bare form — the corpus
  // bound in this file's header, fired a third time. An entry naming a
  // construct does not cover that construct's ATTRIBUTES.
  iconWithSizeAndColor: '![](lu-house){size=32 color=accent}\n',
  // A file-sourced icon, both documented spellings (agents.md, and
  // docs/reference/content-structure.md "Setting the Role"). These carry a
  // `src` and no library/name.
  iconFromFilePrefix: '![Logo](icon:./logo.svg)\n',
  iconFromFileRoleAttr: '![Logo](./logo.svg){role=icon}\n',
  // Every attribute in the published "Video Attributes" table.
  video: '![Demo](./demo.mp4){role=video autoplay muted loop controls poster=./thumb.jpg}\n',
  // The document role and the two attrs it contributed.
  pdf: '![Report](./report.pdf){role=pdf preview=./cover.jpg author=Ada description=Annual}\n',
  // A role that is neither icon nor video — rides through verbatim.
  bannerRole: '![Hero](./hero.jpg){role=banner fit=cover position=center}\n',
  // Clickable media, both documented shapes.
  clickableImage: '![Shot](./s.jpg){href=/products/details}\n',
  clickableVideo: '![Demo](./demo.mp4){role=video href=/demo target=_blank}\n',
  // Every attribute a link and a button take from `{…}` — the published
  // link-attribute table. `role`, `size`, `icon` and `reload` were written and
  // not declared until 2026-10-14, because no entry here gave a link any.
  linkAttrs: '[x](/a){role=nav target=_blank rel=noopener download size=lg icon=lu-arrow-right reload class=lead}\n',
  buttonAttrs: '[Go](button:/x){variant=secondary role=cta target=_blank size=sm icon=lu-arrow-right reload}\n',
  insetRefVisual: '![desc](@Gallery){cols=3}\n',
  insetRefText: 'See [the note](@Cite){key=smith2020}.\n',
  insetBlock: '```@Alert{type=warning}\nBody with **marks** and [links](/x).\n```\n',
  // A tagged PROSE fence. Its body is parsed as blocks, so this entry also has
  // to reach the node types that can only appear INSIDE one.
  conceptBlock: '```md:faq\n# A question\nAn answer with **marks**.\n\n# Another\nWith a [link](/x).\n```\n',
  // The same node in GitHub's spelling. Covered because the ATTRS differ —
  // `syntax` only appears on this path, and an attr no corpus entry writes
  // is exactly what this file's header calls the corpus bound.
  githubAlert: '> [!WARNING]\n> Back up **first**.\n',
  mathInline: 'Euler $e^{i\\pi}+1=0$ here.\n',
  mathDisplay: '$$\n\\int_0^1 x\\,dx\n$$\n',
  mathFence: '```math\nE = mc^2\n```\n',
  table: '| a | b |\n|---|---|\n| 1 | 2 |\n',
  // A table's caption line — the only place a table's attributes come from.
  tableCaptionLine: '| a | b |\n|---|---|\n| 1 | 2 |\n\n: Plans and prices {placement=wide #tbl-plans}\n',
  // Where a block sits in a flow, on an image and on a video.
  placedImage: '![Harbour](./harbour.jpg){placement=left}\n',
  placedVideo: '![](./tour.mp4){role=video placement=full}\n',
  // What a node HOLDS, for the content check below — each the case one declared
  // expression got wrong until 2026-09-28.
  blockquoteHoldsBlocks: '> # A quoted heading\n>\n> - an item\n>\n> ![Chart](@Chart)\n',
  blockquoteEmpty: '>\n',
  listItemOpensWithCode: '- ```js\n  x\n  ```\n',
  listItemOpensWithQuote: '- > quoted\n',
  listItemEmpty: '-\n',
  insetBlockEmpty: '```@Alert\n```\n',
  conceptBlockEmpty: '```md:faq\n```\n',
  emptyDocument: '',
}
