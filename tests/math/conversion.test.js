/**
 * latexToMathML conversion tests.
 *
 * Exercises the pure converter without going through markdown parsing.
 * Snapshots are avoided here because Temml output is stable across minor
 * versions for these inputs — if Temml bumps and output drifts, the string
 * assertions below are easier to update than snapshot churn.
 */

import { latexToMathML } from "../../src/math/index.js";

describe("latexToMathML", () => {
  test("inline mode (default) renders a <math> element with xmlns", () => {
    const out = latexToMathML("x^2");
    expect(out.startsWith("<math")).toBe(true);
    expect(out).toContain('xmlns="http://www.w3.org/1998/Math/MathML"');
    expect(out).not.toContain('display="block"');
  });

  test("display mode adds display=\"block\"", () => {
    const out = latexToMathML("x^2", { display: true });
    expect(out).toContain('display="block"');
  });

  test("embeds TeX annotation via semantics node", () => {
    const out = latexToMathML("E = mc^2");
    expect(out).toContain('encoding="application/x-tex"');
    expect(out).toContain("E = mc^2");
  });

  test("renders sum: \\sum_{i=1}^n i^2", () => {
    const out = latexToMathML("\\sum_{i=1}^n i^2", { display: true });
    expect(out).toContain("<mo");
    expect(out).toContain("∑");
  });

  test("renders fraction: \\frac{a}{b}", () => {
    const out = latexToMathML("\\frac{a}{b}");
    expect(out).toContain("<mfrac");
  });

  test("renders integral: \\int_0^\\infty f(x)\\,dx", () => {
    const out = latexToMathML("\\int_0^\\infty f(x)\\,dx", { display: true });
    expect(out).toContain("∫");
    expect(out).toContain("∞");
  });

  test("malformed input renders a temml-error span, not a throw", () => {
    const out = latexToMathML("\\frac{");
    expect(out).toContain("temml-error");
    // The bad source is retained inside the span so the author sees what
    // went wrong.
    expect(out).toContain("\\frac{");
  });

  test("error span strips Temml's ParseError tail and moves it to data-temml-error", () => {
    const out = latexToMathML("\\frac{1}");
    // The span itself must NOT render the parser message inline (that would
    // show up as visible prose inside the page); the message lives on the
    // data-temml-error attribute so foundations can surface it conditionally.
    expect(out).toContain('data-temml-error=');
    expect(out).toContain('ParseError');
    // The white-space: pre-line declaration Temml adds is now meaningless
    // (the tail is gone) and must not leak through.
    expect(out).not.toContain('pre-line');
    // The span's inner text is the bad source alone — no newlines, no
    // parser message.
    const spanMatch = out.match(/<span class="temml-error"[^>]*>([^<]*)<\/span>/);
    expect(spanMatch).not.toBeNull();
    expect(spanMatch[1]).toBe("\\frac{1}");
  });

  test("empty input returns a benign empty <math> element", () => {
    const out = latexToMathML("");
    expect(out.startsWith("<math")).toBe(true);
  });
});
