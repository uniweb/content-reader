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
 * `outsideVocabulary(doc)` names each thing outside the vocabulary, and an empty
 * list means the document is within it. `cleanToVocabulary(doc)` removes each of
 * them and says what it removed — what the renderer would leave out of a page
 * anyway, so a document cleaned at write renders as it would have, and a reader
 * of the store gets only what the vocabulary holds. Anything that stores content
 * written by someone other than the site's developer — an editor's saves, a
 * member's contributions — can run either before it stores.
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
 * The one walk both exports make: each finding, with its path in the document as
 * given, and the document as it is with each found thing removed.
 *
 * What goes, by rule — what the renderer leaves out of a page, removed at write:
 * a node of an unknown type, a malformed node, an inset placeholder whose
 * reference is not an identifier, with what it holds · a mark of an unknown
 * type, a malformed mark, a link or button whose URL may not be followed — the
 * text stays · an attribute a type does not declare, a URL a page may not load,
 * a target, a style name, a colour, MathML outside the allowlist · `attrs`,
 * `marks` or `content` that is not the right kind of value. A root that is not a
 * document becomes an empty one.
 */
function walk(doc) {
    const { nodes, marks } = getBaseSchema();
    const findings = [];
    const find = (path, rule, found) => findings.push({ path: pointer(path), rule, found: String(found) });

    if (!isObject(doc)) {
        find([], "shape", "a document that is not an object");
        return { findings, document: { type: "doc", content: [] } };
    }
    if (doc.type !== "doc") {
        find([], "shape", `a root of type ${JSON.stringify(doc.type)}`);
        return { findings, document: { type: "doc", content: [] } };
    }

    /** The attributes kept, and whether what holds them goes (a mark whose URL may not be followed). */
    const cleanAttrs = (kind, type, def, attrs, path) => {
        if (!isObject(attrs)) {
            find(path, "shape", "attrs that are not an object");
            return { attrs: undefined, drop: false };
        }
        const declared = def.attrs || {};
        const key = `${kind}:${type}`;
        const kept = {};
        let drop = false;
        for (const [name, value] of Object.entries(attrs)) {
            const at = [...path, name];
            const outside = (rule, found) => {
                find(at, rule, found);
                return false;
            };
            let keep = true;
            if (kind === "mark" && type === "span") {
                const own = SPAN_OWN[name];
                if (own === "color" && value !== null && !isCssColor(value)) keep = outside("color", value);
                if (!own && !isStyleName(name)) keep = outside("style-name", name);
            } else if (!def.openAttrs && !(name in declared)) {
                keep = outside("attribute", name);
            } else if (value !== null && value !== undefined) {
                if (URL_ATTRIBUTES[key]?.includes(name) && !isSafeLink(value)) {
                    keep = outside("url", value);
                    if (kind === "mark") drop = true;
                }
                if (TARGET_ATTRIBUTES[key]?.includes(name) && !isLinkTarget(value)) keep = outside("target", value);
                if (MATHML_ATTRIBUTES[key]?.includes(name)) {
                    const reasons = typeof value === "string" ? inspectMathML(value) : [{ reason: "not a string" }];
                    if (reasons.length) {
                        keep = outside("mathml", reasons.map((o) => [o.reason, o.element, o.attribute].filter(Boolean).join(" ")).join(", "));
                    }
                }
                if (key === "node:inset_placeholder" && name === "refId" && !(typeof value === "string" && REF_ID.test(value))) {
                    keep = outside("ref-id", value);
                    drop = true;
                }
            }
            if (keep) kept[name] = value;
        }
        return { attrs: kept, drop };
    };

    const visitMark = (mark, path) => {
        if (!isObject(mark) || typeof mark.type !== "string") {
            find(path, "shape", "a mark with no type");
            return null;
        }
        const markDef = marks[mark.type];
        if (!markDef) {
            find(path, "mark-type", mark.type);
            return null;
        }
        if (mark.attrs === undefined || mark.attrs === null) return mark;
        const { attrs, drop } = cleanAttrs("mark", mark.type, markDef, mark.attrs, [...path, "attrs"]);
        if (drop) return null;
        const out = { ...mark };
        if (attrs === undefined) delete out.attrs;
        else out.attrs = attrs;
        return out;
    };

    const visitNode = (node, path) => {
        if (!isObject(node) || typeof node.type !== "string") {
            find(path, "shape", "a node with no type");
            return null;
        }
        const def = nodes[node.type];
        if (!def) {
            find(path, "node-type", node.type);
            return null;
        }
        const out = { ...node };
        let drop = false;

        if (node.attrs !== undefined && node.attrs !== null) {
            const cleaned = cleanAttrs("node", node.type, def, node.attrs, [...path, "attrs"]);
            drop = cleaned.drop;
            if (cleaned.attrs === undefined) delete out.attrs;
            else out.attrs = cleaned.attrs;
        }

        if (node.type === "text" && typeof node.text !== "string") {
            find([...path, "text"], "shape", "a text node with no text");
            drop = true;
        }

        if (node.marks !== undefined) {
            if (!Array.isArray(node.marks)) {
                find([...path, "marks"], "shape", "marks that are not a list");
                delete out.marks;
            } else {
                out.marks = node.marks.map((mark, i) => visitMark(mark, [...path, "marks", i])).filter(Boolean);
            }
        }

        if (node.content !== undefined) {
            if (!Array.isArray(node.content)) {
                find([...path, "content"], "shape", "content that is not a list");
                delete out.content;
            } else {
                out.content = node.content.map((child, i) => visitNode(child, [...path, "content", i])).filter(Boolean);
            }
        }

        return drop ? null : out;
    };

    return { findings, document: visitNode(doc, []) };
}

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
    return walk(doc).findings;
}

/**
 * A document within the vocabulary: the one given, with each thing outside it
 * removed, and what was removed — each as `outsideVocabulary` names it, its path
 * in the document as given. A store that cleans what it is given, rather than
 * refusing it, writes `document` and can tell the writer `removed`.
 *
 * The input is not changed. Cleaning a clean document returns an equal one and
 * removes nothing.
 *
 * @param {Object|null} doc - a ProseMirror document as JSON; null or undefined is an empty field
 * @returns {{ document: Object|null, removed: Array<{path: string, rule: string, found: string}> }}
 */
export function cleanToVocabulary(doc) {
    if (doc === null || doc === undefined) return { document: doc ?? null, removed: [] };
    const { findings, document } = walk(doc);
    return { document, removed: findings };
}
