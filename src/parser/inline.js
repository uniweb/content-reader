/**
 * @fileoverview Parse inline markdown elements
 */

import { decodeText, isLineBreakTag } from "./text.js";
import { warn } from "./warnings.js";
import { readPlacement } from "./placement.js";

/** A soft line break, with the spaces and tabs on either side of it. */
const SOFT_BREAK = /[ \t]*\n[ \t]*/g;

/**
 * An element's inline nodes, with the space a text begins with dropped right after a
 * `hardBreak`: the line ending that follows a `<br>` — a space by `parseInline` — and the
 * spaces before the next line's words. A reader sees none, since the line already broke.
 * ⛔ Until 2026-10-16 that line ending was kept as a "\n" opening the next text.
 *
 * @param {Array} nodes - ProseMirror inline nodes, in order
 * @returns {Array}
 */
function afterLineBreaks(nodes) {
    return nodes.flatMap((node, i) => {
        if (i === 0 || node.type !== "text" || nodes[i - 1].type !== "hardBreak") return [node];
        const text = node.text.replace(/^[ \t]+/, "");
        return text ? [{ ...node, text }] : [];
    });
}

/**
 * Parse inline markdown content into ProseMirror/Tiptap nodes
 * @param {Object} token - Marked token for inline content
 * @param {Object} schema - ProseMirror schema
 * @returns {Array} Array of ProseMirror inline nodes
 *
 * Notes on implementation choices:
 * - A text node holds the characters a reader sees: every value is decoded
 *   once on its way in (`./text.js`), whichever spelling marked handed over
 * - For formatted text (bold/italic), we use token.tokens to handle nested formatting
 * - Tiptap represents formatting as marks on text nodes, not nested structures
 * - HTML an author writes is not markup: it stays the text it is, except `<br>`
 */
function parseInline(token, schema) {
    if (token.type === "text") {
        // ⭐ A PLAIN NEWLINE INSIDE A PARAGRAPH IS A SPACE (ruled 2026-10-16) — the
        // space a reader sees, as CommonMark renders a soft line break: one space,
        // with the spaces and tabs either side of it dropped. A line break is
        // written on purpose — `<br>`, a backslash or two spaces at the end of the
        // line — and is a `hardBreak` node. So re-wrapping a paragraph changes
        // nothing in its document, and pushing a re-wrap sends nothing.
        // ⛔ Until 2026-10-16 the newline was kept in the text — a re-wrap was an
        // edit — and until 2026-09-29 a list item deleted it, fusing the words
        // either side ("of its\n  sub-organizations" → "itssub-organizations").
        // `raw` is the text as the author wrote it — marked's `.text` escapes
        // it — and a character reference written in it (`&copy;`, `&lt;`)
        // names a character, so it is decoded like every other value.
        return token.raw ? [{ type: "text", text: decodeText(token.raw.replace(SOFT_BREAK, " ")) }] : [];
    }

    if (token.type === "strong" || token.type === "em" || token.type === "del") {
        // Tiptap represents formatting as marks on text nodes
        // For nested formatting like **_text_**, all marks are applied to the same text node
        //
        // `del` is GFM's `~~text~~`. It was previously unhandled, so the
        // tildes fell through as literal text — and the editor's `strike`
        // mark, which is author-reachable, had nowhere to go on the way out.
        const MARK_FOR = { strong: "bold", em: "italic", del: "strike" };
        const mark = { type: MARK_FOR[token.type] };

        return token.tokens.flatMap((t) =>
            parseInline(t, schema).map((node) => ({
                ...node,
                marks: [...(node.marks || []), mark],
            }))
        );
    }

    if (token.type === "html") {
        // HTML is not content: components decide how content renders. A tag
        // an author writes stays the text it is, and shows as written — with
        // one exception, `<br>`, the line break a heading has no other way to
        // spell [Diego, 2026-10-14]. ⛔ Until then the tag was kept as a text
        // node holding it and became live markup on the page.
        if (isLineBreakTag(token.raw)) return [{ type: "hardBreak" }];
        warn(`HTML is not content, so \`${token.raw.trim()}\` shows as written`);
        return [{ type: "text", text: token.raw }];
    } else if (token.type === "br") {
        // A markdown hard break is a NODE, not a "\n" character. A raw newline
        // is not a line break in HTML — white-space collapses it to a space —
        // so a "\n" text node renders as a space, while semantic-parser turns
        // `hardBreak` into <br>. The node form also survives a PM -> HTML -> PM
        // round trip, which fuses the text nodes around a bare newline.
        return [{ type: "hardBreak" }];
    } else if (token.type === "escape") {
        // marked's built-in escape tokenizer produces { raw: "\\$", text: "$" }.
        // Use the unescaped text, not raw, so "\$20" renders as "$20" — and
        // decode it, since marked hands `\<` back as `&lt;`.
        return token.text ? [{ type: "text", text: decodeText(token.text) }] : [];
    }

    // Custom math tokens from inline marked extensions.
    // `mathInline` = $...$, `mathInlineDisplay` = $$...$$ mid-paragraph.
    // Both emit `math_inline` ProseMirror nodes; the `display` attribute
    // distinguishes them so content-writer can roundtrip faithfully.
    if (token.type === "mathInline") {
        return [
            {
                type: "math_inline",
                attrs: {
                    latex: token.latex || "",
                    mathml: token.mathml || "",
                    display: false,
                },
            },
        ];
    }
    if (token.type === "mathInlineDisplay") {
        // Mid-paragraph $$...$$ — Pandoc / GitHub treat this as display
        // math that stays inline (no paragraph break). We model it as an
        // inline node so it rides inside the paragraph content, with
        // `display: true` so it renders with displayMode styling and
        // roundtrips back to $$...$$.
        return [
            {
                type: "math_inline",
                attrs: {
                    latex: token.latex || "",
                    mathml: token.mathml || "",
                    display: true,
                },
            },
        ];
    }

    // marked escapes these values (a code span's `<` arrives as `&lt;`); a
    // node holds the characters themselves.
    const text = decodeText(token.text);

    if (token.type === "codespan") {
        return [
            {
                type: "text",
                marks: [{ type: "code" }],
                text,
            },
        ];
    }

    if (token.type === "span") {
        // Bracketed span: [text]{accent}, [text]{class=lead}, [text]{.any-name}
        //
        // NOT `[text]{.class}` — a leading dot is part of the attribute NAME and
        // carries no special meaning, so `{.lead}` yields `{".lead": true}`, an
        // inert boolean. The CSS-class shorthand was retired with the rest of the
        // class syntax (see the header of ./attributes.js).
        //
        // Supports nested formatting via tokens
        const { class: className, id, ...otherAttrs } = token.attrs || {};

        const spanMark = {
            type: "span",
            attrs: {
                ...(className && { class: className }),
                ...(id && { id }),
                ...otherAttrs,
            },
        };

        // If there are child tokens (nested formatting), process them
        if (token.tokens && token.tokens.length > 0) {
            return token.tokens.flatMap((t) =>
                parseInline(t, schema).map((node) => ({
                    ...node,
                    marks: [...(node.marks || []), spanMark],
                }))
            );
        }

        // Simple text span
        return [
            {
                type: "text",
                marks: [spanMark],
                text: decodeText(token.text),
            },
        ];
    }

    if (token.type === "cite") {
        // Cite shorthand: `[@key]` / `[@key]{k=v}` / `[@a;@b]{k=v}`.
        // Sugar for an inline `inset_ref` with component=Cite. Keys ride on
        // a `key` attr (semicolon-separated when multi-cite). embedKind is
        // 'text' — cites render as words in prose.
        const { class: _class, ...otherAttrs } = token.attrs || {};
        return [{
            type: "inset_ref",
            attrs: {
                component: "Cite",
                embedKind: "text",
                key: token.text,
                alt: null,
                ...otherAttrs,
            },
        }];
    }

    if (token.type === "ref") {
        // Cross-reference shorthand: `[#id]` / `[#id]{k=v}` / `[#a;#b]{k=v}`.
        // Counterpart of the cite shorthand — same structural shape,
        // different sigil and different lookup namespace. Sugar for an
        // inline inset_ref with component='Ref'; the framework's <Ref>
        // component resolves the id(s) via the per-document xref-registry
        // populated from {#id} attributes on labeled elements.
        const { class: _class, ...otherAttrs } = token.attrs || {};
        return [{
            type: "inset_ref",
            attrs: {
                component: "Ref",
                embedKind: "text",
                key: token.text,
                alt: null,
                ...otherAttrs,
            },
        }];
    }

    if (token.type === "link") {
        // `[text](@Component){k=v}` — inline-textual inset. Same machinery
        // as the image-form `![alt](@Component){k=v}` but `embedKind: 'text'`
        // signals "render this component as a word in prose, not as an
        // embedded visual element." Keyed-reference convention: a `text`
        // starting with `@` is a key into a foundation-known collection
        // (e.g. `[@darwin1859](@Cite){page=42}`).
        if (token.href.startsWith('@') && token.href.length > 1) {
            const component = token.href.slice(1);
            const { role: _role, ...otherAttrs } = token.attrs || {};
            const text = token.text || "";
            const isKeyed = text.startsWith('@');
            return [{
                type: "inset_ref",
                attrs: {
                    component,
                    embedKind: "text",
                    alt: isKeyed ? null : (text || null),
                    ...(isKeyed ? { key: text } : {}),
                    ...otherAttrs,
                },
            }];
        }

        // A link becomes a button via the `button:` href prefix or a bare
        // `button` flag — `[Go](/x){button}`, the same author-label form as
        // `{accent}`. This replaces the old `.button` CSS-class spelling,
        // which went with the rest of the class syntax (see attributes.js).
        const hasButtonPrefix = token.href.startsWith("button:");
        const hasButtonFlag = token.attrs?.button === true;
        const isButton = hasButtonPrefix || hasButtonFlag;

        const href = hasButtonPrefix ? token.href.substring(7) : token.href;

        // Extract known link/button attributes from curly brace attrs
        const {
            button: _buttonFlag,  // consumed above as the type indicator
            role,     // Optional hint for components (e.g., "button", "nav")
            variant = "primary",
            download,
            target,
            rel,
            size,
            icon,
            reload,
            ...otherAttrs
        } = token.attrs || {};

        // `class` survives as an INTEROP path, not an authoring feature.
        //
        // The CSS-class *shorthand* (`{.featured}`) is retired — a leading dot is
        // now part of the attribute name and means nothing. But the explicit
        // `{class=x}` spelling is still parsed here, deliberately: it is one half
        // of a matched pair with `@uniweb/content-writer`, which serializes a
        // class back out as `{class=x}`. That pair is what lets a class on an
        // EDITOR-authored node survive a round trip through the file lane.
        //
        // (An earlier version of this comment claimed `class` was "no longer
        // produced by the attribute syntax". That was never true of the explicit
        // spelling — the tokenizer has no filter on the literal key `class`.
        // Decision to keep the pair and correct the comment: Diego, 2026-07-29.)
        const className = otherAttrs.class;

        const linkMark = {
            type: isButton ? "button" : "link",
            attrs: {
                href,
                title: token.title ? decodeText(token.title) : null,
                ...(role && { role }),
                ...(isButton && { variant }),
                ...(download !== undefined && { download }),
                ...(target && { target }),
                ...(rel && { rel }),
                ...(size && { size }),
                ...(icon && { icon }),
                ...(reload !== undefined && { reload }),
                ...(className && { class: className }),
            },
        };

        // A link label is inline content, not a string: `[*Sense*](/x)` has to
        // come out italic-and-linked, the way CommonMark specifies. Recurse
        // into the label's own tokens and add the link mark to each resulting
        // node — the same shape the strong/em handler above uses. Emitting one
        // flat text node instead left the label's markup as literal asterisks.
        //
        // marked gives a single text token for a plain label, so the common
        // case still produces exactly one node.
        if (Array.isArray(token.tokens) && token.tokens.length > 0) {
            const children = token.tokens.flatMap((t) =>
                parseInline(t, schema).map((node) => ({
                    ...node,
                    // A link cannot nest inside a link. marked autolinks a
                    // bare URL even when that URL is the LABEL of an explicit
                    // link, so `[http://x.com](/y)` arrives with a link mark
                    // already on the label text and would end up carrying two.
                    // Round-tripping a bare `http://x.com` produced exactly
                    // that: the writer expands it to `[url](url)`, which then
                    // reparsed with a doubled mark. The OUTER link wins — it
                    // is the one the author wrote.
                    marks: [
                        ...(node.marks || []).filter(
                            (m) => m.type !== "link" && m.type !== "button",
                        ),
                        linkMark,
                    ],
                })),
            );
            if (children.length > 0) return children;
        }

        return [
            {
                type: "text",
                marks: [linkMark],
                text,
            },
        ];
    }

    if (token.type === "image") {
        // Check for @ component reference: ![alt](@ComponentName){key=value}
        // The `!` form is the visual-embed inset — `embedKind: 'visual'`.
        // block.js only block-extracts these when they're the sole element
        // of a paragraph; mid-prose visual insets stay inline. The `[text](@C)`
        // (no `!`) variant lives in the link branch above with embedKind: 'text'.
        if (token.href.startsWith('@') && token.href.length > 1) {
            const component = token.href.slice(1)
            const { role: _role, ...otherAttrs } = token.attrs || {}
            const altText = text || ''
            const isKeyed = altText.startsWith('@')
            return [{
                type: "inset_ref",
                attrs: {
                    component,
                    embedKind: "visual",
                    alt: isKeyed ? null : (altText || null),
                    ...(isKeyed ? { key: altText } : {}),
                    ...otherAttrs,
                },
            }]
        }

        let role, src, iconLibrary, iconName;

        // Supported icon families - friendly names and direct react-icons codes
        // The runtime maps friendly names to CDN paths
        const ICON_FAMILIES_FRIENDLY = [
            'lucide', 'heroicons', 'heroicons2', 'phosphor', 'tabler', 'feather',
            'fa', 'fa6', 'bootstrap', 'material-design', 'ant-design', 'remix',
            'simple-icons', 'ionicons', 'boxicons', 'vscode', 'weather', 'game'
        ];
        const ICON_FAMILIES_SHORT = [
            'lu', 'hi', 'hi2', 'pi', 'tb', 'fi', 'bs', 'md', 'ai',
            'ri', 'si', 'io5', 'bi', 'vsc', 'wi', 'gi', 'fa', 'fa6'
        ];
        const allFamilies = [...ICON_FAMILIES_FRIENDLY, ...ICON_FAMILIES_SHORT];
        const iconFamilyPattern = allFamilies.join('|');
        const shortCodePattern = ICON_FAMILIES_SHORT.join('|');

        // Check for colon format: lucide:house, lu:house
        // Note: 'icon:' is NOT included here - it's a role prefix, not a library
        const colonMatch = token.href.match(new RegExp(`^(${iconFamilyPattern}):(.+)$`));

        // Check for dash format with short codes: lu-house, hi-arrow-right
        // Only short codes (2-3 chars) to avoid ambiguity with regular paths
        const dashMatch = !colonMatch && token.href.match(new RegExp(`^(${shortCodePattern})-(.+)$`));

        if (colonMatch) {
            iconLibrary = colonMatch[1];
            iconName = colonMatch[2];
            role = "icon";
            src = null;
        } else if (dashMatch) {
            iconLibrary = dashMatch[1];
            iconName = dashMatch[2];
            role = "icon";
            src = null;
        }
        // Find the first colon to handle role:url format correctly (e.g., icon:path/to/file.svg)
        else if (token.href.includes(":") && !token.href.startsWith("http")) {
            const colonIndex = token.href.indexOf(":");
            role = token.href.substring(0, colonIndex);
            src = token.href.substring(colonIndex + 1);
        } else {
            src = token.href;
        }

        // Extract known image attributes from curly brace attrs
        const {
            role: attrRole,
            caption: attrCaption,  // {caption="…"} as attr — first-class slot
            width,
            height,
            size,         // Icon size (shorthand for width=height)
            loading,
            poster,       // For videos: explicit poster image
            preview,      // For PDFs/documents: preview image
            // For documents (role=pdf): metadata an embed renders beside the
            // preview. `description` is NOT `alt` — alt describes the *image*
            // for assistive tech, this describes the *resource*.
            author,
            description,
            autoplay,
            muted,
            loop,
            controls,
            fit,          // object-fit: cover, contain, etc.
            position,     // object-position
            placement,    // where it sits in a flow: left, right, wide, full
            color,        // Icon color
            href,         // Clickable media — wraps the rendered media in a link
            target,       // …and its link target
            ...otherAttrs
        } = token.attrs || {};

        // Attribute role takes precedence over prefix role
        const finalRole = attrRole || role || "image";
        const finalPlacement = readPlacement(placement, finalRole === "video" ? "video" : "image");

        return [
            {
                type: "image",
                attrs: {
                    src,
                    // Caption can come from either the title slot
                    // `![alt](src "title")` or the curly-brace attr
                    // `![alt](src){caption="…"}`. The attr form takes
                    // precedence — it's the supported author surface.
                    caption: attrCaption || decodeText(token.title) || null,
                    alt: text || null,
                    role: finalRole,
                    // Icon-specific attributes
                    ...(iconLibrary && iconLibrary !== "icon" && { library: iconLibrary }),
                    ...(iconName && { name: iconName }),
                    ...(size && { size }),
                    ...(color && { color }),
                    // Dimension attributes
                    ...(width && { width: parseInt(width, 10) || width }),
                    ...(height && { height: parseInt(height, 10) || height }),
                    // Loading behavior
                    ...(loading && { loading }),
                    // Media attributes (for video/document roles)
                    ...(poster && { poster }),
                    ...(preview && { preview }),
                    ...(author && { author }),
                    ...(description && { description }),
                    // Video-specific attributes
                    ...(autoplay !== undefined && { autoplay }),
                    ...(muted !== undefined && { muted }),
                    ...(loop !== undefined && { loop }),
                    ...(controls !== undefined && { controls }),
                    // Styling attributes
                    ...(fit && { fit }),
                    ...(position && { position }),
                    // Where it sits in a flow
                    ...(finalPlacement && { placement: finalPlacement }),
                    // Clickable media
                    ...(href && { href }),
                    ...(target && { target }),
                    // EXACTLY these two, not "any other custom attribute" — the
                    // image node is a CLOSED content model, so `{data-x=1}` is
                    // tokenized and then dropped here. Neither of these is a
                    // leftover:
                    //   `id`    — load-bearing. `{#fig-cells}` is the figure
                    //             cross-reference anchor: kit's xref registry
                    //             reads `attrs.id` and maps image → figure, which
                    //             is what renders "Figure 3". Press relies on it
                    //             for text→image references.
                    //   `class` — an interop path, not an authoring feature; the
                    //             matched half of content-writer's `{class=x}`
                    //             output, so an editor-authored class survives a
                    //             round trip. The `{.featured}` shorthand is gone.
                    ...(otherAttrs.class && { class: otherAttrs.class }),
                    ...(otherAttrs.id && { id: otherAttrs.id }),
                },
            },
        ];
    }

    // Handle unknown token types as plain text
    return token.raw ? [{ type: "text", text: token.raw }] : [];
}

/**
 * Inline tokens as ProseMirror inline nodes — the one walk an element's words take, whether a
 * paragraph's, a heading's or a list item's (`block.js`, `lists.js`), or a value read as inline
 * markdown alone (`inlineMarkdownToProseMirror`).
 *
 * @param {Array} tokens - Marked inline tokens
 * @param {Object} schema - ProseMirror schema
 * @returns {Array} ProseMirror inline nodes
 */
function parseInlineTokens(tokens, schema) {
    return afterLineBreaks(tokens.flatMap((t) => parseInline(t, schema)));
}

export { parseInline, parseInlineTokens, afterLineBreaks };
