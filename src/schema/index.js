/**
 * @fileoverview Base schema definition compatible with TipTap v2
 */

const baseNodes = {
    doc: {
        content: "block+",
    },

    paragraph: {
        content: "inline*",
        group: "block",
    },

    heading: {
        attrs: {
            level: { default: 1 },
            id: { default: null },
            // "pretitle" marks a `#>` label line; null is an ordinary heading.
            // Consumers querying headings generically must exclude the role:
            // subset attr-matchers (tiptap's isActive({level: 2}), any
            // objectIncludes-style check) count a pretitle as a heading of its
            // carried level — measured in a tiptap-based integration, where
            // the H2 control lit for a pretitle until the query was scoped
            // with role: null.
            role: { default: null },
        },
        content: "inline*",
        group: "block",
    },

    text: {
        group: "inline",
    },

    // Emitted for BOTH markdown hard-break spellings (two trailing spaces, and a
    // trailing backslash) — see the codec doc's "Hard breaks" invariant. A bare
    // "\n" text node is a SOFT break and deliberately stays a text node; healing
    // one into a hardBreak writes a trailing `\` into the author's file.
    //
    // Declared 2026-07-29 after it was found EMITTED-but-UNDECLARED: the parity
    // test's `hardBreak` corpus entry used a single "\n", which produces no
    // hardBreak at all, so the suite stayed green while the type escaped the
    // inventory that consumers generate their schemas from.
    hardBreak: {
        inline: true,
        group: "inline",
        selectable: false,
    },

    image: {
        attrs: {
            // Core attributes
            src: {},
            caption: { default: null },
            alt: { default: null },
            role: { default: "image" }, // image, icon, hero, video, pdf, etc.
            // Store-held asset reference — the pair a host resolves through its
            // declared URL pattern, in place of a baked `src`. Like the icon
            // pair below, this is a REFERENCE a consumer resolves at render, and
            // that is the whole point: a URL freezes one host's route layout into
            // content that outlives it, while an id is re-resolved every time.
            //
            // `assetExt` is separate rather than derived because the id carries
            // no extension — it is an opaque store key — and every lane that
            // would have to re-derive one would be parsing a string it was handed.
            //
            // ⚠️ Declared here 2026-08-17, in the same change that started
            // emitting them. The comment below records three prior rounds of
            // "EMITTED but UNDECLARED", each found by a consumer rather than by
            // this package — this pair would have been the fourth. An attr
            // missing here is not a rendering bug (the parser reads whatever
            // arrives on the node); it is dropped by anything that VALIDATES
            // against this schema, which is the silent half.
            assetId: { default: null },
            assetExt: { default: null },
            // ⭐ A node carries MORE THAN ONE asset reference: `src` above, plus
            // a video's `poster` and a document's `preview` below. Identity has
            // to name which one it belongs to, or a producer cannot record a
            // poster's id without inventing vocabulary — which is exactly what
            // the app lane hit, and correctly refused to do, on 2026-08-17.
            //
            // Flat and declared rather than a nested `assets: {…}` map: a nested
            // map puts identity inside a value this schema cannot see, which is
            // the property that makes a reference buried in an opaque field
            // impossible to enumerate or re-point. The convention is
            // **unprefixed identifies the PRIMARY reference (`src`); a prefix
            // names the attr it belongs to.**
            posterAssetId: { default: null },
            posterAssetExt: { default: null },
            previewAssetId: { default: null },
            previewAssetExt: { default: null },
            // Icon reference — `![](lu-house)` yields role:"icon" with a null
            // `src` and the glyph named instead: `library` is the family prefix
            // ("lu", "hi", "hi2", …) and `name` the icon within it. The pair is
            // a REFERENCE, not a payload: a consumer resolves it to markup at
            // render time, so preserving both is what keeps the icon swappable.
            // Inlining the resolved SVG in their place freezes it.
            library: { default: null },
            name: { default: null },
            // Icon presentation — `{size=20}` and `{color=red}`, the two
            // optional attrs the authoring guide documents beside the icon
            // syntax (cli/partials/agents.md, which ships as AGENTS.md in every
            // project). `size` is the icon's shorthand for width=height.
            //
            // Declared 2026-07-30 after the frontend found them EMITTED but
            // UNDECLARED — the third time the parity corpus's bound has fired,
            // and the first where the undeclared attr was already a PUBLISHED
            // authoring spelling. See tests/schema-parity.test.js, which now
            // derives a corpus from the docs so a documented attr cannot go
            // undeclared again.
            //
            // `preserveColors` is deliberately NOT here. It is a kit <Icon>
            // prop and an editor attr with no authoring spelling, by the
            // boundary recorded internally:
            // this node is a REFERENCE that a consumer resolves, and control
            // over the resolved markup belongs to the component layer. A
            // themable custom graphic is an inset (SVG+JSX reading semantic
            // tokens — see templates/marketing .../insets/Diagram), which is
            // strictly more capable than any attribute here could be.
            size: { default: null },
            color: { default: null },
            // Dimension attributes
            width: { default: null },
            height: { default: null },
            // Loading behavior
            loading: { default: null }, // lazy, eager
            // Media attributes (for video/document roles)
            poster: { default: null },  // Explicit poster image for videos
            preview: { default: null }, // Preview image for PDFs/documents
            // Document metadata (role=pdf) — what an embed renders beside the
            // preview. `description` is deliberately NOT `alt`: alt describes
            // the *image* for assistive tech; this describes the *resource*.
            //
            // Added 2026-07-29 for the editor's `document` node, which folds
            // into this row rather than becoming a type of its own. That is the
            // same move `role=video` already made — this node's attribute set is
            // the UNION of its roles' needs (video contributed `poster`,
            // `autoplay`, `muted`, `loop`, `controls`; documents contributed
            // `preview`). "Closed" here means enumerable, not frozen: a named,
            // documented attr for a first-class role is not the arbitrary
            // passthrough the closure exists to prevent.
            author: { default: null },
            description: { default: null },
            // Video-specific attributes
            autoplay: { default: null },
            muted: { default: null },
            loop: { default: null },
            controls: { default: null },
            // Styling attributes
            fit: { default: null },     // object-fit: cover, contain, fill, etc.
            position: { default: null }, // object-position
            // Clickable media — `![Shot](./s.jpg){href=/products target=_blank}`.
            // Documented in docs/reference/content-structure.md ("Clickable
            // Images and Videos"), down to the shape it yields, and read by
            // semantic-parser's parseImgBlock, which has always destructured
            // and returned both. Only the EMISSION was missing, so the
            // documented attribute was tokenized and dropped here — the
            // receiving half built, the sending half never wired. Found
            // 2026-07-30 while honoring the video role, same defect class.
            href: { default: null },
            target: { default: null },
            // Generic attributes
            class: { default: null },
            id: { default: null },
        },
        // group: "block inline",
    },

    inset_ref: {
        // OPEN attribute set — see `openAttrs` below.
        openAttrs: true,
        attrs: {
            component: {},
            alt: { default: null },
            // Dynamic attributes from {key=value} syntax are also stored here
        },
        group: "block",
    },

    inset_placeholder: {
        attrs: {
            refId: {},
        },
        group: "block",
    },

    // Block form of an inset — a ```@Component{params} fence (parser/block.js
    // `parseContainerInfo`). The same token as `inset_ref`, one level up: it
    // holds parsed block content, so a callout can wrap prose instead of being
    // a self-contained atom.
    inset_block: {
        // OPEN attribute set — see `openAttrs` below. `{type=warning}` and every
        // other container param rides here alongside `component`.
        openAttrs: true,
        attrs: {
            component: {},
            // Dynamic attributes from {key=value} syntax are also stored here
        },
        content: "block+",
        group: "block",
    },

    // A TAGGED PROSE fence — ```md:faq — whose body is markdown, parsed here
    // into real block content exactly like an `inset_block`'s.
    //
    // The `tag` is a DISCRIMINATOR, not a component name and not a gate: it says
    // *which concept this is* so an editor can offer a specialized surface for
    // it, while rendering stays a foundation decision. Nothing in this package —
    // or in semantic-parser, content-writer, runtime, core or kit — branches on
    // its value; a framework-side registry of concept names is the failure this
    // shape exists to avoid. The set of concepts lives in the editor, which owns
    // it legitimately.
    //
    // Distinct from `dataBlock` (```yaml:nav), which carries field-shaped data
    // parsed to a value and passed through opaquely. This one carries PROSE, and
    // the note on `dataBlock` below — "rich prose belongs in content rather than
    // in here" — is why it is a node with `content` rather than an attribute.
    //
    // Its derived shape is fixed by the FENCE, unconditionally: a concept block
    // is always an item array (`parseContent(doc, { alwaysItems: true })`), so no
    // schema is consulted to decide it and the tag stays opaque. A body with no
    // headings is the degenerate single-item case — one titleless item carrying
    // the prose — which is what a callout (```md:warning) is.
    //
    // Ships together with content-writer's serializer and the editor's TipTap
    // registration: an undeclared node type fails a strict consumer's WHOLE
    // document, so none of the three can land alone.
    concept_block: {
        attrs: {
            tag: {},
            // Which spelling the author wrote: a ```md:<tag> fence (default,
            // null) or GitHub's `> [!WARNING]` alert (`gfm`). One node, two
            // surfaces — recorded so the serializer writes back what was
            // written. Without it a `> [!WARNING]` returns as a fence on the
            // next editor sync, which is the defect `dataBlock.language` was
            // added to fix for ```yaml silently becoming ```json.
            syntax: { default: null },
        },
        content: "block+",
        group: "block",
    },

    // The one attribute a divider has, and the one kit renders: `hr` (default)
    // vs `dots` (`kit/styled/Section/renderers/Divider.jsx`). Authored as
    // `---{type=dots}`; a bare `---` leaves it unset and renders as a rule.
    //
    // `style` and `size` were removed 2026-07-29 — declared vocabulary nothing
    // could reach. Nothing in kit, runtime or core read either, the semantic
    // parser dropped both, content-writer serialized every divider to `---`
    // regardless, and no markdown spelling could set them. Same shape as
    // `eyebrowHeading`: freezing them in would have told a consumer to support
    // values that never arrive. Verified before removing that nothing compiles
    // this spec into a strict Schema, so no stored document fails to load for
    // carrying them — they are simply ignored now, as they always were.
    divider: {
        attrs: {
            type: { default: null },
        },
        group: "block",
    },

    // List nodes.
    //
    // `loose` records the markdown distinction between a tight list (items are
    // bare inline content) and a loose one (blank lines between items, so each
    // item wraps its content in a paragraph). It is set only when true, so its
    // absence means tight. Content, not presentation: it is a property of what
    // the author wrote, and dropping it silently re-tightens the list on the
    // next write.
    bulletList: {
        attrs: {
            loose: { default: false },
        },
        content: "listItem+",
        group: "block",
    },

    orderedList: {
        attrs: {
            start: { default: 1 },
            loose: { default: false },
        },
        content: "listItem+",
        group: "block",
    },

    listItem: {
        content: "paragraph block*",
        defining: true,
    },

    // Code blocks
    // A TAGGED fence — ```yaml:Card — parsed at read time into structured data.
    // Distinct from `codeBlock`, which is source to display: this is data to
    // consume, and `<Prose>` deliberately skips it so a component can read it
    // from `content.data[tag]` instead.
    //
    // Declared 2026-07-29 after it was found EMITTED-but-UNDECLARED — the third
    // instance of that class (after `hardBreak` and the corpus gap that hid it),
    // and the highest-consequence one: a consumer that rejects unknown types
    // fails the WHOLE document, and a tagged data block is something authors
    // reach for deliberately rather than an edge case.
    //
    // `data` is the parsed value and is intentionally unconstrained (any YAML or
    // JSON shape). It is passed through opaquely — nothing downstream re-parses
    // a string inside it as markdown, which is why rich prose belongs in content
    // (items, or an `inset_block` body) rather than in here.
    dataBlock: {
        attrs: {
            tag: {},
            language: { default: null },
            data: { default: null },
        },
        group: "block",
        atom: true,
    },

    // Source to DISPLAY, with syntax highlighting — as opposed to `dataBlock`
    // above, which is data to consume.
    //
    // `tag` is here because a TAGGED fence lands on this node whenever its body
    // does not parse into data: a language the reader has no parser for
    // (```toml:Config), or a malformed ```yaml:/```json: body. `parser/block.js`
    // emits `{ language, tag }` on that path and `content-writer`'s
    // `serializeCodeBlock` reads it back to re-emit `lang:tag`, so dropping it
    // rewrites the author's ```yaml:nav as a bare ```yaml on the next save.
    //
    // Declared 2026-07-30 — the FOURTH emitted-but-undeclared instance, and the
    // first the parity corpus could not have caught: its two tagged entries
    // (`dataBlockYaml`, `dataBlockJson`) both parse SUCCESSFULLY, so they exit
    // through `dataBlock` and no entry reached the only branch that emits this.
    // A corpus that covers a construct does not necessarily cover the FALLBACK
    // that construct degrades to. `codeBlockTagged*` below close it.
    codeBlock: {
        attrs: {
            language: { default: null },
            tag: { default: null },
            filename: { default: null },
        },
        content: "text*",
        marks: "", // No marks (formatting) allowed inside code blocks
        group: "block",
        code: true,
        defining: true,
    },
    blockquote: {
        content: "inline*",
        group: "block",
    },

    // Math nodes — LaTeX compiled to MathML Core at parse time.
    // The `mathml` attr is the HTML string that flows through the content
    // pipeline and lands in kit's HTML renderers via dangerouslySetInnerHTML.
    // The `latex` attr is the source — kept for roundtrip (content-writer)
    // and editor popover display.
    math_inline: {
        attrs: {
            latex: { default: "" },
            mathml: { default: "" },
            // `display: true` marks mid-paragraph $$...$$ — rendered with
            // displayMode styling but still occupying an inline slot.
            // Preserves the Pandoc distinction through roundtrip.
            display: { default: false },
        },
        group: "inline",
        inline: true,
        atom: true,
        selectable: true,
        // parseDOM recovers nodes from HTML previously produced by toDOM
        // (copy/paste, Tiptap export). Alien pastes with only data-latex
        // yield an empty mathml; a future normalisation pass can backfill
        // via latexToMathML if needed. This runs in schema-consumer
        // contexts that must stay Temml-free, so do not call it here.
        parseDOM: [
            {
                tag: 'span[data-type="inline-math"]',
                getAttrs: (el) => ({
                    latex: el.getAttribute("data-latex") || "",
                    mathml: el.innerHTML || "",
                }),
            },
        ],
        toDOM: (node) => {
            // In non-DOM contexts (SSR, test suites without jsdom) return the
            // spec form. The authoritative HTML serialiser for runtime is
            // semantic-parser's getTextContent, not DOMSerializer.
            if (typeof document === "undefined") {
                return [
                    "span",
                    {
                        "data-type": "inline-math",
                        "data-latex": node.attrs.latex,
                    },
                ];
            }
            const span = document.createElement("span");
            span.setAttribute("data-type", "inline-math");
            span.setAttribute("data-latex", node.attrs.latex);
            const tpl = document.createElement("template");
            tpl.innerHTML = node.attrs.mathml || "";
            span.appendChild(tpl.content);
            return span;
        },
    },

    math_display: {
        attrs: {
            latex: { default: "" },
            mathml: { default: "" },
            // Optional label for numbered equations (set via ```math:<id> fence).
            // Consumed by foundations that render numbered cross-referenceable
            // equations from content.math — see @uniweb/scholar/math.
            id: { default: null },
        },
        group: "block",
        atom: true,
        selectable: true,
        parseDOM: [
            {
                tag: 'div[data-type="block-math"]',
                getAttrs: (el) => ({
                    id: el.getAttribute("data-id") || null,
                    latex: el.getAttribute("data-latex") || "",
                    mathml: el.innerHTML || "",
                }),
            },
        ],
        toDOM: (node) => {
            if (typeof document === "undefined") {
                return [
                    "div",
                    {
                        "data-type": "block-math",
                        "data-latex": node.attrs.latex,
                        ...(node.attrs.id ? { "data-id": node.attrs.id } : {}),
                    },
                ];
            }
            const div = document.createElement("div");
            div.setAttribute("data-type", "block-math");
            div.setAttribute("data-latex", node.attrs.latex);
            if (node.attrs.id) div.setAttribute("data-id", node.attrs.id);
            const tpl = document.createElement("template");
            tpl.innerHTML = node.attrs.mathml || "";
            div.appendChild(tpl.content);
            return div;
        },
    },
    // Table nodes
    table: {
        content: "tableRow+",
        group: "block",
        tableRole: "table",
    },

    tableRow: {
        content: "tableCell+",
        tableRole: "row",
    },

    tableCell: {
        content: "paragraph+",
        attrs: {
            colspan: { default: 1 },
            rowspan: { default: 1 },
            align: { default: null }, // left, center, right
            header: { default: false },
        },
        tableRole: "cell",
    },
};

const baseMarks = {
    bold: {},
    italic: {},
    link: {
        attrs: {
            href: {},
            title: { default: null },
            // Extended attributes
            target: { default: null },   // _blank, _self, etc.
            rel: { default: null },      // noopener, noreferrer, etc.
            download: { default: null }, // Download attribute (true or filename)
            class: { default: null },
        },
    },
    button: {
        attrs: {
            href: {},
            title: { default: null },
            variant: { default: "primary" }, // primary, secondary, outline, ghost, etc.
            // Extended attributes
            size: { default: null },     // sm, md, lg
            icon: { default: null },     // Icon name or path
            target: { default: null },
            rel: { default: null },
            download: { default: null },
            class: { default: null },
        },
    },
    code: {
        // For inline code
        inclusive: true,
        code: true,
    },

    strike: {},

    // Bracketed span — `[text]{accent}` / `[text]{.cls key=value}`
    // (parser/inline.js, token type "span").
    //
    // Attribute names are OPEN-ENDED, and the NAME is the payload: `{accent}`
    // yields `attrs: { accent: true }`, and theme.yml's `inline:` block
    // generates a matching `span[accent] { … }` rule (@uniweb/theming's
    // css-generator). So an attribute name IS the binding between authored
    // text and the site's theme — half of one theme-driven feature, not
    // decoration.
    //
    // Consumers must round-trip unknown attribute names VERBATIM. Substituting
    // a resolved value (e.g. mapping to a literal colour) freezes a theme-bound
    // style and takes the site's theme out of the loop permanently.
    span: {
        // OPEN attribute set — and here the attribute NAME is the payload:
        // `[text]{accent}` binds to theme.yml's `inline:` block by that name.
        openAttrs: true,
        attrs: {
            class: { default: null },
            id: { default: null },
            // Any other `{name}` / `{key=value}` pair is stored here too
        },
    },
};

/**
 * Get the base schema definition
 * @returns {Object} Combined schema with nodes and marks
 */
function getBaseSchema() {
    return {
        nodes: baseNodes,
        marks: baseMarks,
    };
}

export { getBaseSchema };
