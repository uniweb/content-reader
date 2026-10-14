/**
 * The rich-text vocabulary — what a stored document in this format may hold —
 * and a check of a document against it.
 *
 * A document's node types, mark types and their attributes are the schema's
 * (`getBaseSchema()`): what the reader writes, and what a renderer reads. Some
 * attribute values reach the markup a renderer builds — a link's URL, a span's
 * style names, a formula's MathML — and those follow the renderer's own rules
 * (`@uniweb/semantic-parser/sanitize`), imported here rather than restated, so
 * the check and the renderer cannot disagree about what a value may be.
 *
 * A document is checked, not cleaned. `outsideVocabulary(doc)` names each thing
 * outside the vocabulary, and an empty list means the document is within it. A
 * writer refused with what it sent can fix it, where a cleaned value changes
 * without a word. Anything that stores content written by someone other than
 * the site's developer — an editor's saves, a member's contributions — can run
 * the same check before it stores.
 *
 * Text is never checked: a text node holds the characters a reader sees, and a
 * renderer escapes them. `<` is a legitimate character in a sentence.
 *
 * ⛔ Not checked: where a node may sit (a schema's content expressions), and the
 * values of attributes no rule names. Both decide how a document renders, never
 * what markup it can put on a page.
 *
 * @module @uniweb/content-reader/vocabulary
 */

import {
    allowlists,
    inspectMathML,
    isCssColor,
    isLinkTarget,
    isSafeLink,
    isStyleName,
} from "@uniweb/semantic-parser/sanitize";
import { getBaseSchema } from "./schema/index.js";

/** The attributes that hold a URL a page follows or loads. */
const URL_ATTRIBUTES = {
    "mark:link": ["href"],
    "mark:button": ["href"],
    "node:image": ["src", "href", "poster", "preview"],
};

/** The attributes that name where a link opens. */
const TARGET_ATTRIBUTES = {
    "mark:link": ["target"],
    "mark:button": ["target"],
    "node:image": ["target"],
};

/** A span's attributes with a meaning of their own; any other name is a style name. */
const SPAN_OWN = { class: "text", id: "text", color: "color", bg: "color" };

const MATHML_ATTRIBUTES = { "node:math_inline": ["mathml"], "node:math_display": ["mathml"] };

const REF_ID = /^[A-Za-z][A-Za-z0-9_-]*$/;

const flatten = (byType) =>
    Object.entries(byType).flatMap(([type, names]) => names.map((name) => `${type}.${name}`));

/**
 * The vocabulary as data: every node and mark type with its attributes, and the
 * rules values follow — for a reader that implements the check in another
 * language. A type marked `open` takes any attribute name.
 *
 * @returns {Object} JSON-serializable
 */
export function richTextVocabulary() {
    const { nodes, marks } = getBaseSchema();
    const types = (defs) =>
        Object.fromEntries(
            Object.entries(defs).map(([type, def]) => [
                type,
                { attributes: Object.keys(def.attrs || {}), open: Boolean(def.openAttrs) },
            ]),
        );
    const rules = allowlists();
    const { targets, ...link } = rules.link;
    return {
        nodes: types(nodes),
        marks: types(marks),
        rules: {
            shape: {
                description:
                    "The root is a node of type `doc`. A node is an object with a string `type`; its `attrs`, when present, an object; its `content` an array of nodes; its `marks` an array of objects with a string `type` and, when present, object `attrs`. A text node's `text` is a string.",
            },
            "node-type": { description: "A node's type is one of `nodes`." },
            "mark-type": { description: "A mark's type is one of `marks`." },
            attribute: {
                description:
                    "An attribute of a type that is not `open` is one of its `attributes`. A null value is always allowed: it means unset, and no rule below applies to it.",
            },
            url: {
                attributes: flatten(URL_ATTRIBUTES),
                description: "A URL with no scheme, or one of `schemes`.",
                ...link,
            },
            target: {
                attributes: flatten(TARGET_ATTRIBUTES),
                description: "One of `targets`, exactly.",
                targets,
            },
            "style-name": {
                attributes: ["mark:span.<any name but class, id, color and bg>"],
                description: "A style name: it matches `pattern`, does not start with `on` in any case, and is none of `not` in any case.",
                ...rules.styleName,
            },
            color: {
                attributes: ["mark:span.color", "mark:span.bg"],
                description: "A CSS colour: a string matching `pattern` and not matching `notMatching`.",
                ...rules.color,
            },
            mathml: {
                attributes: flatten(MATHML_ATTRIBUTES),
                description:
                    "MathML within the allowlist: every element one of `elements`; none of `droppedWithContent`; every attribute one of `attributes` or a common one, never a handler or a link, its value never matching `unsafeValue`; every style declaration kept; no comment, doctype or processing instruction.",
                ...rules.mathml,
            },
            "ref-id": {
                attributes: ["node:inset_placeholder.refId"],
                description: "An identifier.",
                pattern: REF_ID.source,
            },
        },
    };
}

/** JSON Pointer (RFC 6901) for a path of keys and indexes. */
function pointer(path) {
    return path.map((key) => "/" + String(key).replace(/~/g, "~0").replace(/\//g, "~1")).join("");
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Each thing in a document outside the vocabulary — empty when it is within.
 *
 * A finding names WHERE (`path`, a JSON Pointer into the document), WHICH rule
 * (`rule`) and WHAT was found (`found`, for a message). The findings come in
 * document order; a check implemented elsewhere that walks in another order
 * compares them as a set.
 *
 * @param {Object|null} doc - a ProseMirror document as JSON; null or undefined is an empty field
 * @returns {Array<{path: string, rule: string, found: string}>}
 */
export function outsideVocabulary(doc) {
    if (doc === null || doc === undefined) return [];
    const { nodes, marks } = getBaseSchema();
    const findings = [];
    const find = (path, rule, found) => findings.push({ path: pointer(path), rule, found: String(found) });

    if (!isObject(doc)) {
        find([], "shape", "a document that is not an object");
        return findings;
    }
    if (doc.type !== "doc") find([], "shape", `a root of type ${JSON.stringify(doc.type)}`);

    const checkAttrs = (kind, type, def, attrs, path) => {
        if (attrs === undefined || attrs === null) return;
        if (!isObject(attrs)) return find(path, "shape", "attrs that are not an object");
        const declared = def.attrs || {};
        const key = `${kind}:${type}`;
        for (const [name, value] of Object.entries(attrs)) {
            const at = [...path, name];
            if (kind === "mark" && type === "span") {
                const own = SPAN_OWN[name];
                if (own === "color" && value !== null && !isCssColor(value)) find(at, "color", value);
                if (!own && !isStyleName(name)) find(at, "style-name", name);
                continue;
            }
            if (!def.openAttrs && !(name in declared)) {
                find(at, "attribute", name);
                continue;
            }
            if (value === null || value === undefined) continue;
            if (URL_ATTRIBUTES[key]?.includes(name) && !isSafeLink(value)) find(at, "url", value);
            if (TARGET_ATTRIBUTES[key]?.includes(name) && !isLinkTarget(value)) find(at, "target", value);
            if (MATHML_ATTRIBUTES[key]?.includes(name)) {
                const outside = typeof value === "string" ? inspectMathML(value) : [{ reason: "not a string" }];
                if (outside.length) {
                    find(at, "mathml", outside.map((o) => [o.reason, o.element, o.attribute].filter(Boolean).join(" ")).join(", "));
                }
            }
            if (key === "node:inset_placeholder" && name === "refId" && !(typeof value === "string" && REF_ID.test(value))) {
                find(at, "ref-id", value);
            }
        }
    };

    const visit = (node, path) => {
        if (!isObject(node) || typeof node.type !== "string") {
            find(path, "shape", "a node with no type");
            return;
        }
        const def = nodes[node.type];
        if (!def) find(path, "node-type", node.type);
        else checkAttrs("node", node.type, def, node.attrs, [...path, "attrs"]);

        if (node.type === "text" && typeof node.text !== "string") find([...path, "text"], "shape", "a text node with no text");

        if (node.marks !== undefined) {
            if (!Array.isArray(node.marks)) find([...path, "marks"], "shape", "marks that are not a list");
            else
                node.marks.forEach((mark, i) => {
                    const at = [...path, "marks", i];
                    if (!isObject(mark) || typeof mark.type !== "string") return find(at, "shape", "a mark with no type");
                    const markDef = marks[mark.type];
                    if (!markDef) return find(at, "mark-type", mark.type);
                    checkAttrs("mark", mark.type, markDef, mark.attrs, [...at, "attrs"]);
                });
        }

        if (node.content !== undefined) {
            if (!Array.isArray(node.content)) find([...path, "content"], "shape", "content that is not a list");
            else node.content.forEach((child, i) => visit(child, [...path, "content", i]));
        }
    };

    visit(doc, []);
    return findings;
}
