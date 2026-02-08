/**
 * @fileoverview Parse block-level markdown elements
 */

import { marked } from "marked";
import yaml from "js-yaml";
import { parseInline } from "./inline.js";
import { parseList } from "./lists.js";
import { parseTable } from "./tables.js";

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

        // extract images to the root level
        const result = [];
        let currentParagraph = null;

        content.forEach((element) => {
            if (
                (element.type === "image" && element.attrs?.role !== "icon") ||
                element.type === "inline_child_ref"
            ) {
                // Extract non-icon images to root level so they become
                // block-level elements. Icons stay inline so the semantic
                // parser can associate them with adjacent links.
                if (currentParagraph) {
                    result.push({
                        type: "paragraph",
                        content: currentParagraph,
                    });
                    currentParagraph = null; // Reset the current paragraph
                }
                // Push the image directly to the result
                result.push(element);
            } else {
                // Start a new paragraph if there isn't one open
                if (!currentParagraph) {
                    currentParagraph = [];
                }
                // Add the non-image element to the current paragraph
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

    if (token.type === "code") {
        const { language, tag } = processCodeInfo(token.lang);
        const rawText = cleanCodeText(token.text);

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
