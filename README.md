# Content Reader

A JavaScript library for converting Markdown content into ProseMirror-compatible document structures. This library is designed to work seamlessly with TipTap v2 and provides enhanced Markdown parsing capabilities with support for extended syntax.

## Features

### Basic Markdown Support

- Paragraphs and basic text formatting (bold, italic)
- Headings with automatic ID generation
- Links and images
- Ordered and unordered lists with nesting support
- Code blocks with language and filename support
- Tables with alignment and formatting
- Block quotes
- Horizontal rules

### Extended Syntax

#### Curly Brace Attributes

Add rich attributes to images and links using `{...}` syntax:

```markdown
![Alt](./image.jpg){role=hero width=800 loading=lazy}
[Link](https://example.com){target=_blank rel=noopener}
[Button](https://example.com){.button variant=secondary icon=arrow}
```

**Supported attribute formats:**
- `key=value` - Standard attribute
- `key="value with spaces"` - Quoted value
- `.className` - CSS class (multiple allowed)
- `#idName` - Element ID
- `booleanAttr` - Boolean attribute (sets to `true`)

#### Image Attributes

```markdown
# Basic image with role and dimensions
![Hero](./hero.jpg){role=hero width=1200 height=600}

# Video with poster and playback options
![Intro Video](./intro.mp4){role=video poster=./poster.jpg autoplay muted loop}

# PDF with preview thumbnail
![User Guide](./guide.pdf){role=pdf preview=./preview.jpg}

# Styling attributes
![Background](./bg.jpg){fit=cover position=center loading=lazy}

# Classes and IDs
![Logo](./logo.svg){.featured .rounded #main-logo}
```

| Attribute | Description |
|-----------|-------------|
| `role` | Semantic role: `image`, `icon`, `hero`, `video`, `pdf`, etc. |
| `width`, `height` | Dimensions (pixels) |
| `loading` | Loading behavior: `lazy`, `eager` |
| `poster` | Poster image for videos |
| `preview` | Preview image for PDFs/documents |
| `autoplay`, `muted`, `loop`, `controls` | Video playback options |
| `fit` | Object-fit: `cover`, `contain`, `fill`, etc. |
| `position` | Object-position value |
| `.class`, `#id` | CSS class and ID |

#### Link Attributes

```markdown
# External link with target
[External Link](https://example.com){target=_blank rel="noopener noreferrer"}

# Download link
[Download PDF](./document.pdf){download}

# Link with custom filename for download
[Get Report](./data.pdf){download="annual-report.pdf"}
```

| Attribute | Description |
|-----------|-------------|
| `target` | Link target: `_blank`, `_self`, etc. |
| `rel` | Link relationship: `noopener`, `noreferrer`, etc. |
| `download` | Download attribute (boolean or filename) |
| `.class` | CSS class |

#### Button Attributes

Buttons can be created using the `.button` class or the legacy `button:` prefix:

```markdown
# Using .button class (recommended)
[Get Started](https://example.com){.button variant=primary size=lg}
[Learn More](https://example.com){.button variant=secondary icon=arrow-right}

# Legacy prefix syntax (still supported)
[Button Text](button:https://example.com)
```

| Attribute | Description |
|-----------|-------------|
| `variant` | Style variant: `primary`, `secondary`, `outline`, `ghost` |
| `size` | Button size: `sm`, `md`, `lg` |
| `icon` | Icon name or path |
| `target`, `rel`, `download` | Same as links |

#### Bracketed Spans

Style inline text with semantic classes using Pandoc-style bracketed spans:

```markdown
# Basic class
This has [highlighted text]{.highlight} for emphasis.

# Multiple classes
Here's [styled text]{.highlight .large} with two classes.

# ID attribute
Jump to [this section]{#anchor-point}.

# Class and ID together
[Important note]{.callout #note-1}

# Custom attributes
[Hover me]{.tooltip data-tip="More info here"}
```

Output structure:

```js
{
  type: "text",
  text: "highlighted text",
  marks: [{ type: "span", attrs: { class: "highlight" } }]
}
```

| Syntax | Result |
|--------|--------|
| `[text]{.class}` | `<span class="class">` |
| `[text]{#id}` | `<span id="id">` |
| `[text]{.a .b}` | `<span class="a b">` |
| `[text]{key=value}` | `<span key="value">` |

Spans can be combined with other marks (bold, italic, links).

#### Inline Insets — `[text](@Component)` and `![alt](@Component)`

Inline references to foundation components, with two embed modes that
differ in author intent and renderer treatment:

```markdown
# Textual inset (no `!`) — renders as a word in prose.
As Darwin observed [in his classic work](@Cite){key=darwin1859}, the
mechanism of selection acts on heritable variation.

# Visual inset (with `!`) — renders as an inline visual element
# (badge, pill, quote tile, etc.) embedded in the surrounding prose.
This study has shipped ![New release](@Badge){type=success} and is
ready for review.
```

| Form | `embedKind` | Use case |
|---|---|---|
| `[text](@Component){k=v}` | `'text'` | Textual substitution — component renders as words. |
| `![alt](@Component){k=v}` | `'visual'` | Visual embed — inline visual element. |

The `@` prefix on the URL slot is the disambiguator (no real URL starts
with `@`). The two forms produce the same `inset_ref` node with
`embedKind` distinguishing them; foundations may render the two modes
differently or treat them identically.

**Keyed-reference convention** — when the alt/text slot starts with
`@`, the value rides on a `key=` attribute instead of `alt=`. Authors
use this when the inset references an entry by id:

```markdown
![@hero-image](@Banner){variant=large}    # Banner with key=hero-image
[@interview-bao](@Quote){length=short}    # Textual quote with key=interview-bao
```

Block-level placement: a `![alt](@Component){k=v}` on its own line is
hoisted to the document root (same as standalone images). Mid-prose
visual insets stay inline. Textual insets always stay inline.

#### Citation Shorthand — `[@key]`

Pandoc-style cite sugar that compiles to an inline `inset_ref` with
`component: 'Cite'`. Used by foundations that ship a Cite renderer
(see `@uniweb/book` for the reference implementation).

```markdown
As Darwin (1859) showed [@darwin1859]{suppress-author}, selection acts
on heritable variation [@darwin1859]{page=42}. Independent contemporary
work [@wallace1858; @lyell1830] reached compatible conclusions.
```

| Markdown | Compiles to |
|---|---|
| `[@key]` | `inset_ref { component: Cite, key: 'key', embedKind: text }` |
| `[@key]{page=42}` | + `page: 42` |
| `[@a; @b]` | `inset_ref { component: Cite, key: 'a;b', ... }` (multi-cite cluster) |
| `[@key]{suppress-author}` | + `suppress-author: true` |

#### Cross-reference Shorthand — `[#id]`

Counterpart to the cite sugar, using `#` to look up internal labels in
the framework's per-document cross-reference registry. Compiles to an
`inset_ref` with `component: 'Ref'` — the framework's built-in
cross-reference renderer that the runtime registers for every
foundation.

```markdown
## Method {#sec-method}

The method is described above (see [#sec-method]).

![A cell undergoing mitosis](mitosis.png){#fig-cells caption="Mitosis."}

We discuss this in [#sec-method] and [#fig-cells]{page=12}.

The two figures together: [#fig-cells; #fig-meiosis].

A missing ref renders as a visible placeholder: [#nope-typo] →
"[?nope-typo]" with the failing key surfaced.
```

| Markdown | Renders as (humanities preset) |
|---|---|
| `[#fig-cells]` | Figure 3 |
| `[#fig-cells]{page=12}` | Figure 3 (p. 12) |
| `[#sec-method]` | §3.2 |
| `[#eq-einstein]` | Equation 1 |
| `[#a; #b]` | Figures 3 and 4 (same-kind cluster) |
| `[#nope]` | [?nope] (visible missing-id placeholder) |

The framework infers the kind from the host element type:

| Element | Kind |
|---|---|
| Heading: `## Method {#id}` | `section` |
| Image: `![alt](src){#id}` | `figure` |
| Math display: `$$E=mc^2$$ {#id}` | `equation` |
| Table with trailing `{#id}` | `table` |

Foundations may declare additional kinds (theorem, exhibit, etc.) via
their `xref.kinds` config; see the foundation's documentation.

#### Legacy Prefix Syntax

The original prefix syntax is still supported for backward compatibility:

```markdown
# Image with role prefix
![Alt text](icon:path/to/icon.svg)
![Alt text](hero:path/to/bg.jpg)

# Button with prefix
[Button Text](button:https://example.com)
```

#### Tables with Alignment

Full support for aligned columns:

```markdown
| Left | Center | Right |
| :--- | :----: | ----: |
| Text |  Text  |  Text |
```

### Developer-Friendly Features

- Clean, well-documented code
- Comprehensive test suite
- Modular architecture for easy extension
- Compatible with TipTap v2 document structure
- Full TypeScript type definitions

## Installation

```bash
npm install @uniweb/content-reader
```

## Usage

Basic usage:

```javascript
const { markdownToProseMirror } = require("@uniweb/content-reader");

const markdown = `
# Hello World

This is a **bold** statement with a [link](https://example.com).

- List item 1
- List item 2
  - Nested item
`;

const doc = markdownToProseMirror(markdown);
```

### Using with TipTap

The library is designed to work seamlessly with TipTap editors:

```javascript
import { Editor } from "@tiptap/core";
import { markdownToProseMirror } from "@uniweb/content-reader";

const editor = new Editor({
  content: markdownToProseMirror(markdown),
  // ... other TipTap configuration
});
```

### Advanced Features

#### Working with Rich Media

The library supports extended syntax for images, videos, and documents:

```javascript
const markdown = `
![Hero Banner](./hero.jpg){role=hero width=1200 fit=cover}
![Intro Video](./intro.mp4){role=video poster=./poster.jpg autoplay muted}
![Documentation](./guide.pdf){role=pdf preview=./preview.jpg}
`;

const doc = markdownToProseMirror(markdown);
// Each media element will have rich attributes for component rendering
```

#### Working with Buttons and Links

Create styled buttons and links with attributes:

```javascript
const markdown = `
[Get Started](https://example.com){.button variant=primary size=lg}
[Download](./file.pdf){download}
[External](https://example.com){target=_blank rel=noopener}
`;

const doc = markdownToProseMirror(markdown);
// Links and buttons will have appropriate attributes for rendering
```

#### Handling Tables with Alignment

Tables support column alignment and formatted content:

```javascript
const markdown = `
| Name | Status | Actions |
|:-----|:------:|--------:|
| John | Active | **Edit** |
| Jane | Away   | *View*   |
`;

const doc = markdownToProseMirror(markdown);
// Table cells will have appropriate alignment attributes
```

## Architecture

The library is organized into several modules:

- **Parser Core**: Handles the main parsing logic and orchestration
- **Block Parser**: Processes block-level elements
- **Inline Parser**: Handles inline formatting and text
- **Extensions**: Manages extended syntax features
- **Schema**: Defines the document structure

## Contributing

We welcome contributions! Please see our contributing guidelines for details.

### Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/uniweb/content-reader.git
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run tests:
   ```bash
   npm test
   ```

### Testing

The project uses Jest for testing. Run the test suite:

```bash
npm test
```

Or in watch mode:

```bash
npm run test:watch
```

## License

Apache License 2.0 - See [LICENSE](LICENSE) for details.

## Credits

Developed and maintained by UniWeb CMS. Special thanks to all contributors.
