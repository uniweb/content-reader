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
 * @param {string} latex
 * @param {Object} [opts]
 * @param {boolean} [opts.display=false] - true for block display math
 * @returns {string} MathML as an HTML string. On malformed input Temml
 *                   emits a `<span class="temml-error">` containing the
 *                   LaTeX source — authors see that something is wrong
 *                   without the page blowing up.
 */
export function latexToMathML(latex, { display = false } = {}) {
  return temml.renderToString(latex || '', {
    displayMode: display,
    throwOnError: false,
    xml: true,
    annotate: true,
  })
}
