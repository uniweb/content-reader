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

- **Enhanced Images**: Support for image roles (content, background, icon, gallery) using prefix syntax:

  ```markdown
  ![Alt text](icon:path/to/icon.svg)
  ![Alt text](background:path/to/bg.jpg)
  ```

- **Enhanced Links**: Button variants with predefined styles:

  ```markdown
  [Button Text](button:https://example.com)
  ```

- **Tables with Alignment**: Full support for aligned columns:
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

#### Working with Image Roles

The library supports extended image syntax for different display contexts:

```javascript
const markdown = `
![Header image](background:header.jpg)
![Profile photo](gallery:profile.jpg)
![Settings](icon:settings.svg)
`;

const doc = markdownToProseMirror(markdown);
// Each image will have a 'role' attribute in its output structure
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
