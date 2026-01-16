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
npm install @uniwebcms/content-reader
```

## Usage

Basic usage:

```javascript
const { markdownToProseMirror } = require("@uniwebcms/content-reader");

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
import { markdownToProseMirror } from "@uniwebcms/content-reader";

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
   git clone https://github.com/uniwebcms/content-reader.git
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
