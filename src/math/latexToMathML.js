/**
 * @fileoverview LaTeX → MathML conversion for markdown math nodes.
 *
 * Runs at markdown parse time, never at render time. The returned string
 * is stored on a ProseMirror math node's `mathml` attribute and rides
 * through the content pipeline unchanged. Browsers render MathML
 * natively — no runtime library, no CSS dependency, no CDN.
 *
 * Keeping Temml confined to this module is load-bearing: content-reader
 * is a build-time package and must never be imported into a site's
 * runtime bundle.
 */

import temml from 'temml'

/**
 * Convert a LaTeX math expression to a self-contained MathML HTML string.
 *
 * Options in use:
 * - `displayMode`   — block vs inline math (controls `<math display="block">`).
 * - `throwOnError`  — keep false so malformed LaTeX renders as an inline
 *                     `<span class="temml-error">` with the source instead
 *                     of breaking the build.
 * - `xml`           — emit `xmlns="http://www.w3.org/1998/Math/MathML"`
 *                     on the root `<math>` element so the string is valid
 *                     in XHTML contexts (EPUB) as well as HTML.
 * - `annotate`      — embed `<annotation encoding="application/x-tex">`
 *                     so the original LaTeX travels with the MathML.
 *
 * Error-span shape on malformed input: Temml normally emits
 *   <span class="temml-error" style="...white-space:pre-line;">SOURCE
 *
 *   ParseError: ...</span>
 * which renders the parser message inline in the flow of the page. That
 * looks like a page crash. We reshape it to:
 *   <span class="temml-error" data-temml-error="ParseError: ...">SOURCE</span>
 * so the rendered page shows only the bad source; the full parser message
 * is available to foundations via the data-temml-error attribute.
 *
 * @param {string} latex
 * @param {Object} [opts]
 * @param {boolean} [opts.display=false] - true for block display math
 * @returns {string} MathML as an HTML string. On malformed input the
 *                   returned span contains the LaTeX source and carries
 *                   the Temml parser message as a data-* attribute —
 *                   authors see that something is wrong without the
 *                   parser stack fragment polluting the page.
 */
export function latexToMathML(latex, { display = false } = {}) {
  const raw = temml.renderToString(latex || '', {
    displayMode: display,
    throwOnError: false,
    xml: true,
    annotate: true,
  })
  return cleanupErrorSpan(raw)
}

/**
 * Reshape Temml's verbose error span into a quieter, data-annotated form.
 * If Temml did not produce an error span, the input is returned unchanged.
 */
function cleanupErrorSpan(html) {
  return html.replace(
    /<span class="temml-error"(?:\s+style="([^"]*)")?>([\s\S]*?)<\/span>/,
    (_, style, inner) => {
      const sepIdx = inner.indexOf('\n\n')
      const source = sepIdx < 0 ? inner : inner.slice(0, sepIdx)
      const message = sepIdx < 0 ? '' : inner.slice(sepIdx + 2).trim()
      // Temml's inline style sets white-space: pre-line so the \n\n inside
      // the span renders as a break. With the message stripped there are
      // no newlines left, so drop that declaration.
      const cleanedStyle = (style || '')
        .replace(/white-space\s*:\s*pre-line\s*;?/gi, '')
        .replace(/;\s*;/g, ';')
        .trim()
      const attrs = [
        'class="temml-error"',
        ...(message ? [`data-temml-error="${escapeAttr(message)}"`] : []),
        ...(cleanedStyle ? [`style="${cleanedStyle}"`] : []),
      ]
      return `<span ${attrs.join(' ')}>${source}</span>`
    },
  )
}

function escapeAttr(s) {
  // Temml text content is already HTML-escaped for display inside a span.
  // Inside an attribute the only thing that needs special handling is the
  // literal double quote — convert to the numeric entity so the resulting
  // attribute value stays valid.
  return String(s).replace(/"/g, '&#34;')
}
