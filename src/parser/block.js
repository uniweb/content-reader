/**
 * @fileoverview Parse block-level markdown elements
 */

import { marked } from "marked";
import yaml from "js-yaml";
import { parseInline } from "./inline.js";
import { parseList } from "./lists.js";
import { parseTable } from "./tables.js";
import { latexToMathML } from "../math/index.js";
import { parseAttributeString } from "./attributes.js";

/**
 * Split a container fence's info string into its component and params.
 *
 * `@Alert{type=warning}` → `{ component: "Alert", type: "warning" }`
 * `@Details`            → `{ component: "Details" }`
 *
 * Returns null when the info string is not a well-formed component token, so
 * an odd fence falls through to an ordinary code block rather than becoming a
 * container with a nonsense name.
 *
 * @param {string} info - The fence info string, starting with `@`
 * @returns {Object|null}
 */
function parseContainerInfo(info) {
    const match = /^@([A-Za-z][\w-]*)\s*(?:\{([^}]*)\})?\s*$/.exec(info);
    if (!match) return null;

    const [, component, attrString] = match;
    return { component, ...parseAttributeString(attrString || "") };
}

/**
 * Strip a trailing `{#id ...attrs}` block from a heading's inline
 * children. Marked's built-in heading tokenizer doesn't parse attribute
 * blocks, so we post-process the parsed inline content: if the last
 * text node ends with `{...}`, peel it off, parse the attrs, and
 * return them alongside the cleaned content.
 */
function extractTrailingHeadingAttrs(content) {
  if (!Array.isArray(content) || content.length === 0) return { content, attrs: {} };
  const last = content[content.length - 1];
  if (last?.type !== "text" || typeof last.text !== "string") return { content, attrs: {} };
  // The only documented trailing-attribute form on a heading is the
  // cross-reference label `{#id}` (see content-reader/README.md
  // "Cross-reference Shorthand — [#id]" and the table that lists
  // `## Method {#id}` -> kind: 'section'). The .class and key=value
  // forms are syntactically valid in Pandoc but are not part of
  // Press/Uniweb's heading surface — no markdown in this monorepo
  // uses them, no downstream consumer reads them, and accepting them
  // here would only re-create the trailing-Loom-expression bug class
  // that motivated the original tightening.
  //
  // Match strictly: `# Heading {#identifier}` with optional whitespace
  // around the id. Anything else inside the braces (including `#id
  // .class`) leaves the heading text untouched.
  const m = /^([\s\S]*?)\s*\{\s*#([a-zA-Z_][\w-]*)\s*\}\s*$/.exec(last.text);
  if (!m) return { content, attrs: {} };
  const cleaned = m[1].replace(/\s+$/, "");
  const attrs = { id: m[2] };
  // Replace the last text node with the cleaned variant; drop entirely
  // if cleaning left it empty.
  const next = content.slice(0, -1);
  if (cleaned.length > 0) next.push({ ...last, text: cleaned });
  return { content: next, attrs };
}

/**
 * GitHub's five alert kinds. A CLOSED set with a published definition, which is
 * what makes reading them here a convention rather than a concept registry —
 * nothing else in the framework learns these names, and an unrecognized marker
 * stays an ordinary blockquote rather than becoming a concept block with a
 * junk tag.
 */
const ALERT_KINDS = new Set([
    "NOTE",
    "TIP",
    "IMPORTANT",
    "WARNING",
    "CAUTION",
]);

/**
 * Read a `[!KIND]` marker off the front of a parsed blockquote body.
 *
 * The marker owns its whole line, so it is the first paragraph's first text
 * node — and that paragraph is dropped when the marker is all it held, which
 * is the normal shape. A marker with trailing text on the same line keeps the
 * remainder as prose rather than discarding it.
 *
 * @param {Array} content - the blockquote's parsed block content
 * @returns {{ tag: string, content: Array }|null} null when this is an
 *   ordinary blockquote, which includes an unknown marker
 */
function readAlertMarker(content) {
    const [first, ...rest] = content || [];
    if (first?.type !== "paragraph") return null;

    const [lead, ...inline] = first.content || [];
    if (lead?.type !== "text" || typeof lead.text !== "string") return null;

    const match = /^\[!([A-Za-z]+)\]\s*/.exec(lead.text);
    if (!match || !ALERT_KINDS.has(match[1].toUpperCase())) return null;

    const remainder = lead.text.slice(match[0].length);
    const head = remainder
        ? [{ ...lead, text: remainder }, ...inline]
        : inline;

    return {
        tag: match[1].toLowerCase(),
        content: head.length ? [{ ...first, content: head }, ...rest] : rest,
    };
}

/**
 * Process code block info string (e.g., "json:tag-name")
 * @param {string} info - Code block info string
 * @returns {Object} Language and optional tag
 */
function processCodeInfo(info) {
    if (!info) return { language: null, tag: null };

    const parts = info.split(":");
    return {
        language: parts[0] || null,
        tag: parts[1] || null,
    };
}

/**
 * Clean code block text
 * @param {string} text - Raw code block text
 * @returns {string} Cleaned text
 */
function cleanCodeText(text) {
    // Remove common indent (for indented code blocks)
    const lines = text.split("\n");
    const indent = lines[0].match(/^\s*/)[0];
    return lines
        .map((line) =>
            line.startsWith(indent) ? line.slice(indent.length) : line
        )
        .join("\n")
        .trim();
}

/**
 * Parse code block content based on language
 * Only parses tagged blocks with json/yaml language
 * @param {string} text - Raw code block text
 * @param {string} language - Code block language
 * @returns {*} Parsed data or null if not parseable
 */
function parseCodeBlockData(text, language) {
    if (!text) return null;

    const lang = (language || "").toLowerCase();

    if (lang === "json") {
        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    }

    if (lang === "yaml" || lang === "yml") {
        try {
            return yaml.load(text);
        } catch {
            return null;
        }
    }

    return null;
}

/**
 * Parse a paragraph's content by tokenizing with marked
 * @param {Object} token - Marked token for paragraph
 * @param {Object} schema - ProseMirror schema
 * @returns {Array} Array of ProseMirror inline nodes
 */
function parseParagraph(token, schema) {
    // // Use marked's inline lexer to properly handle inline code
    // const inlineTokens = marked.Lexer.lexInline(token.text || token.raw);
    // return inlineTokens.flatMap((t) => parseInline(t, schema));

    // Use the pre-parsed tokens instead of re-lexing
    return token.tokens.flatMap((t) => parseInline(t, schema));
}

/**
 * Parse block level content
 * @param {Object} token - Marked token for block content
 * @param {Object} schema - ProseMirror schema
 * @returns {Object|null} ProseMirror block node or null if empty
 */
/**
 * Parse a list of tokens into a content array.
 *
 * parseBlock answers null for a token with no node of its own — the `space`
 * marked emits for a blank line inside a blockquote, most often — and flatMap
 * keeps a null return as a null element. Every caller therefore has to remember
 * to drop them, and a null left in a content array reaches every downstream
 * reader: the first one to touch node.attrs throws.
 *
 * Two callers existed and one remembered. So the walk lives here instead, and
 * the next container node type — a callout, a figure — gets the guarantee
 * without having to know about it.
 *
 * @param {Array} tokens - marked tokens
 * @param {Object} schema - ProseMirror schema
 * @returns {Array} Content nodes, with nothing empty in it
 */
function parseBlocks(tokens, schema) {
    return (tokens || []).flatMap((token) => parseBlock(token, schema) ?? []);
}

function parseBlock(token, schema) {
    // console.log("BLOCK TOKEN: ", token);
    // Skip HTML comments
    if (token.type === "html" && token.text.startsWith("<!--")) {
        return null;
    }

    if (token.type === "paragraph") {
        const content = parseParagraph(token, schema);

        if (!content.length) {
            return null;
        }

        // Detect "block-eligible" elements that may be hoisted to the
        // document root rather than ride inside the paragraph:
        //   - non-icon images (figures)
        //   - inset_ref nodes with embedKind: 'visual' (the `!` form)
        // Inline-textual inset_refs (embedKind: 'text', the `[text](@C)`
        // / `[@key]{k=v}` forms) NEVER hoist — they're meant to render
        // as words in prose.
        const isBlockEligible = (el) =>
            (el.type === "image" && el.attrs?.role !== "icon") ||
            (el.type === "inset_ref" && el.attrs?.embedKind !== "text");

        // Visual insets surrounded by other inline content (mid-prose
        // badges, quotes, etc.) should stay inline. Only hoist visual
        // insets when they appear in a paragraph that contains nothing
        // else — that's the standalone `![alt](@Component){k=v}` line
        // that authors mean to place as a block.
        //
        // Icons (`![](lu-foo)`) are inline-natural — they sit happily
        // inside prose. They don't disqualify hoisting of a block-eligible
        // sibling: a paragraph of `![](lu-foo)\n![alt](url)` should hoist
        // the image to block level while leaving the icon in the
        // remaining paragraph remnant. Without this allowance the icon
        // would block hoisting and the image would land inside the
        // paragraph, where the semantic parser's group-level extractor
        // doesn't reach into `paragraph.children` to populate
        // `body.images[]`.
        const isInlineFriendly = (el) =>
            (el.type === "image" && el.attrs?.role === "icon") ||
            (el.type === "text" && (!el.text || /^\s*$/.test(el.text)));
        const onlyBlockEligible = content.every(
            (el) => isBlockEligible(el) || isInlineFriendly(el)
        );
        const blockEligibleCount = content.filter(isBlockEligible).length;
        const hoist = onlyBlockEligible && blockEligibleCount > 0;

        // extract images to the root level (when hoisting applies)
        const result = [];
        let currentParagraph = null;

        content.forEach((element) => {
            if (hoist && isBlockEligible(element)) {
                // Close the running paragraph (if any), then push the
                // hoisted element directly to the document root.
                if (currentParagraph) {
                    result.push({
                        type: "paragraph",
                        content: currentParagraph,
                    });
                    currentParagraph = null;
                }
                result.push(element);
            } else {
                if (!currentParagraph) {
                    currentParagraph = [];
                }
                currentParagraph.push(element);
            }
        });

        // If there's an open paragraph after the last element, push it to the result
        if (currentParagraph) {
            result.push({ type: "paragraph", content: currentParagraph });
        }

        return result;

        // return {
        //     type: "paragraph",
        //     content,
        // };
    }

    if (token.type === "heading") {
        const headingContent = parseParagraph(token, schema);
        // Pull a trailing `{#id ...}` attribute block off the heading's
        // text — marked's built-in heading tokenizer treats it as part
        // of the heading content. The {#id} is the cross-reference
        // label, surfaced as `attrs.id`; other attrs (class, kind, …)
        // ride alongside.
        const { content: cleaned, attrs: trailingAttrs } = extractTrailingHeadingAttrs(headingContent);
        return {
            type: "heading",
            attrs: {
                level: token.depth,
                id: trailingAttrs.id || null,
            },
            content: cleaned,
        };
    }

    // A `#>` label line — a heading carrying role "pretitle". The hash count
    // rides in `level` only for byte-faithful round-trips; it has no meaning.
    if (token.type === "pretitleBlock") {
        const headingContent = parseParagraph(token, schema);
        const { content: cleaned, attrs: trailingAttrs } = extractTrailingHeadingAttrs(headingContent);
        return {
            type: "heading",
            attrs: {
                level: token.level,
                id: trailingAttrs.id || null,
                role: "pretitle",
            },
            content: cleaned,
        };
    }

    if (token.type === "blockquote") {
        const content = parseBlocks(token.tokens, schema);

        // A GitHub alert is a CONCEPT BLOCK in a second spelling:
        //
        //     > [!WARNING]
        //     > Back up your database first.
        //
        // Same node as ```md:warning — same tag, same derived items, same
        // round trip. Authors arrive already knowing this syntax, and
        // supporting it costs one branch rather than a second mechanism.
        //
        // `syntax` records which spelling was written so the serializer can
        // write it back. Without it an author's `> [!WARNING]` returns as a
        // fence on the next editor sync — the same defect `dataBlock.language`
        // was added to fix, where a ```yaml block silently became ```json.
        const alert = readAlertMarker(content);
        if (alert) {
            return {
                type: "concept_block",
                attrs: { tag: alert.tag, syntax: "gfm" },
                content: alert.content,
            };
        }

        return { type: "blockquote", content };
    }

    if (token.type === "hr") {
        return {
            type: "divider",
        };
    }

    // Same node, but authored with an attribute block (`---{type=dots}`). The
    // attrs ride on top of the defaults rather than replacing them, so a spelling
    // that sets only `type` still carries the legacy pair the schema declares.
    if (token.type === "dividerBlock") {
        return {
            type: "divider",
            attrs: { ...(token.attrs || {}) },
        };
    }

    // Custom math block token from the block-level marked extension
    // ($$...$$ on its own line, optionally followed by {#id …attrs}).
    if (token.type === "mathBlock") {
        const attrs = {
            latex: token.latex || "",
            mathml: token.mathml || "",
        };
        if (token.attrs?.id) attrs.id = token.attrs.id;
        return {
            type: "math_display",
            attrs,
        };
    }

    if (token.type === "code") {
        const { language, tag } = processCodeInfo(token.lang);
        const rawText = cleanCodeText(token.text);

        // A fence whose info string names a component is a CONTAINER, not code:
        //
        //     ```@Alert{type=warning}
        //     Body with **marks**, [links](/x), and blocks.
        //     ```
        //
        // The block form of an inset. `![](@Component){params}` is an atom with
        // no children (`agents.md` scopes insets to "self-contained,
        // param-driven"), and child sections are file-level, so a callout
        // between two paragraphs had nowhere to live.
        //
        // The info string is the inset's own token, byte for byte, so this is
        // genuinely one concept at two levels. Purely additive: no language
        // begins with `@`, and `processCodeInfo` splits on `:`, so an
        // `@`-prefixed info string reaches here untouched.
        if (typeof token.lang === "string" && token.lang.startsWith("@")) {
            const container = parseContainerInfo(token.lang);
            if (container) {
                return {
                    type: "inset_block",
                    attrs: container,
                    // The body is markdown, parsed as blocks. What a given
                    // component may hold is the component's contract
                    // (`meta.js` + `uniweb validate`), not the parser's guess —
                    // truncating here would destroy authored prose to satisfy
                    // a schema this parser cannot see.
                    content: parseBlocks(marked.lexer(rawText), schema),
                };
            }
        }

        // Fenced ```math becomes a math_display node, not a codeBlock.
        // LaTeX compilation happens here (build-time) so runtime ships no
        // math library. A `:<id>` suffix (e.g. ```math:einstein) labels
        // the equation for numbered cross-refs via <EquationRef>.
        if (language === "math") {
            const latex = rawText;
            return {
                type: "math_display",
                attrs: {
                    ...(tag && { id: tag }),
                    latex,
                    mathml: latexToMathML(latex, { display: true }),
                },
            };
        }

        // A `md:`-tagged fence is a CONCEPT BLOCK: authored prose under a
        // concept name.
        //
        //     ```md:faq
        //     # What plans do you have?
        //     We have three.
        //     ```
        //
        // The body is markdown, so it is parsed here — once, at read time, by
        // the same recursion the container branch above uses. Nothing
        // downstream re-parses a string as markdown; what gets stored is
        // ProseMirror, like every other node.
        //
        // The `tag` is a DISCRIMINATOR — it says *which concept this is*, so a
        // tool can offer a surface suited to it — and it is deliberately opaque:
        // no branch here or anywhere downstream reads its value, and no schema
        // is consulted to decide the shape. A concept block always derives to an
        // item array, fixed by the fence. That is what keeps the set of concepts
        // out of the framework, where it does not belong; a component name in
        // content would be a rendering instruction, which is a different job.
        //
        // Ordered BEFORE the `if (tag)` branch below, which would otherwise send
        // this to `parseCodeBlockData` — a function that answers with parsed
        // DATA and returns null for anything that is not JSON or YAML. Prose is
        // not data, so it does not belong there; leave that function alone.
        if (language === "md" && tag) {
            return {
                type: "concept_block",
                attrs: { tag },
                content: parseBlocks(marked.lexer(rawText), schema),
            };
        }

        // Tagged blocks become dataBlocks (structured data, not code for display)
        if (tag) {
            const parsedData = parseCodeBlockData(rawText, language);
            if (parsedData !== null) {
                // Successfully parsed - it's a dataBlock.
                //
                // `language` rides along for the same reason it does on the two
                // branches below: it is the serialization the author chose, and
                // it is what `parseCodeBlockData` dispatched on. Without it a
                // ```yaml:nav block has no way back — the parsed value alone
                // cannot say whether it was written as YAML or JSON, so
                // content-writer had to guess, and an author's YAML silently
                // became JSON on an editor sync.
                //
                // Consumers read `tag` and `data` by name (the semantic parser
                // does not spread attrs), so this reaches no rendered output.
                return {
                    type: "dataBlock",
                    attrs: { tag, language, data: parsedData },
                };
            }
            // Parsing failed - fall back to codeBlock with language for runtime fallback
            return {
                type: "codeBlock",
                attrs: { language, tag },
                content: [{ type: "text", text: rawText }],
            };
        }

        // Untagged code block - for display with syntax highlighting
        return {
            type: "codeBlock",
            attrs: { language },
            content: [{ type: "text", text: rawText }],
        };
    }

    if (token.type === "list") {
        return parseList(token, schema, parseBlock);
    }

    if (token.type === "table") {
        return parseTable(token, schema);
    }

    // Handle unknown block types as null
    return null;
}

export { parseBlock, parseParagraph };
