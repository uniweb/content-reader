/**
 * @fileoverview Parse block-level markdown elements
 */

import { marked } from "marked";
import yaml from "js-yaml";
import { parseInline } from "./inline.js";
import { parseList } from "./lists.js";
import { parseTable } from "./tables.js";
import { latexToMathML } from "../math/index.js";

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
        // as words in prose. See kb/framework/plans/
        // unipress-bibliography-via-citestyle.md §3.4.
        const isBlockEligible = (el) =>
            (el.type === "image" && el.attrs?.role !== "icon") ||
            (el.type === "inset_ref" && el.attrs?.embedKind !== "text");

        // Visual insets surrounded by other inline content (mid-prose
        // badges, quotes, etc.) should stay inline. Only hoist visual
        // insets when they appear in a paragraph that contains nothing
        // else — that's the standalone `![alt](@Component){k=v}` line
        // that authors mean to place as a block.
        const onlyBlockEligible = content.every(
            (el) => isBlockEligible(el) || (el.type === "text" && (!el.text || /^\s*$/.test(el.text)))
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

        return {
            type: "heading",
            attrs: {
                level: token.depth,
                id: null,
            },
            content: headingContent,
        };
    }

    if (token.type === "blockquote") {
        const content = token.tokens.flatMap((t) => parseBlock(t, schema));
        return {
            type: "blockquote",
            content,
        };
    }

    if (token.type === "hr") {
        return {
            type: "divider",
            attrs: { style: "line", size: "normal" },
        };
    }

    // Custom math block token from the block-level marked extension
    // ($$...$$ on its own line).
    if (token.type === "mathBlock") {
        return {
            type: "math_display",
            attrs: {
                latex: token.latex || "",
                mathml: token.mathml || "",
            },
        };
    }

    if (token.type === "code") {
        const { language, tag } = processCodeInfo(token.lang);
        const rawText = cleanCodeText(token.text);

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

        // Tagged blocks become dataBlocks (structured data, not code for display)
        if (tag) {
            const parsedData = parseCodeBlockData(rawText, language);
            if (parsedData !== null) {
                // Successfully parsed - it's a dataBlock
                return {
                    type: "dataBlock",
                    attrs: { tag, data: parsedData },
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
        return parseList(token, schema);
    }

    if (token.type === "table") {
        return parseTable(token, schema);
    }

    // Handle unknown block types as null
    return null;
}

export { parseBlock, parseParagraph };
