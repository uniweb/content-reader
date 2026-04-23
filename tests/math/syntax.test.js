/**
 * Math syntax & disambiguation tests for content-reader.
 *
 * Covers the Pandoc / GitHub / VS Code / Jupyter / Obsidian convention:
 *   $x$         inline
 *   $$x$$       display (block when on own line, inline display otherwise)
 *   ```math     fenced display
 *   \$          literal dollar
 */

import { markdownToProseMirror } from "../../src/index.js";

function allNodes(doc) {
  const out = [];
  function walk(n) {
    out.push(n);
    if (n.content) n.content.forEach(walk);
  }
  doc.content.forEach(walk);
  return out;
}

function mathNodes(doc) {
  return allNodes(doc).filter(
    (n) => n.type === "math_inline" || n.type === "math_display"
  );
}

function flattenText(doc) {
  return allNodes(doc)
    .filter((n) => n.type === "text")
    .map((n) => n.text)
    .join("");
}

describe("Math disambiguation matrix (Pandoc rules)", () => {
  test("inline math: Let $f(x) = 5$ be a function", () => {
    const doc = markdownToProseMirror("Let $f(x) = 5$ be a function");
    const math = mathNodes(doc);
    expect(math).toHaveLength(1);
    expect(math[0].type).toBe("math_inline");
    expect(math[0].attrs.latex).toBe("f(x) = 5");
  });

  test("currency prose stays prose: It costs $5 and $10 total", () => {
    const doc = markdownToProseMirror("It costs $5 and $10 total");
    expect(mathNodes(doc)).toHaveLength(0);
    expect(flattenText(doc)).toBe("It costs $5 and $10 total");
  });

  test("single unclosed $ stays prose: Budget: $200", () => {
    const doc = markdownToProseMirror("Budget: $200");
    expect(mathNodes(doc)).toHaveLength(0);
  });

  test("escaped \\$ renders as literal dollar, not math", () => {
    const doc = markdownToProseMirror("The discount is \\$20");
    expect(mathNodes(doc)).toHaveLength(0);
    expect(flattenText(doc)).toBe("The discount is $20");
  });

  test("two consecutive inline maths: $x \\geq 0$ or $y \\leq 100$", () => {
    const doc = markdownToProseMirror("$x \\geq 0$ or $y \\leq 100$");
    const math = mathNodes(doc);
    expect(math).toHaveLength(2);
    expect(math[0].attrs.latex).toBe("x \\geq 0");
    expect(math[1].attrs.latex).toBe("y \\leq 100");
  });

  test("standalone $$...$$ becomes block math_display", () => {
    const doc = markdownToProseMirror("$$\\sum_{i=1}^n i$$");
    const math = mathNodes(doc);
    expect(math).toHaveLength(1);
    expect(math[0].type).toBe("math_display");
    expect(math[0].attrs.latex).toBe("\\sum_{i=1}^n i");
  });

  test("mid-paragraph $$...$$ becomes inline display math", () => {
    const doc = markdownToProseMirror("text $$x$$ more text");
    const math = mathNodes(doc);
    expect(math).toHaveLength(1);
    expect(math[0].type).toBe("math_inline");
    expect(math[0].attrs.display).toBe(true);
    expect(math[0].attrs.latex).toBe("x");
  });

  test("fenced ```math becomes block math_display, not codeBlock", () => {
    const doc = markdownToProseMirror("```math\n\\int f\\,dx\n```");
    const math = mathNodes(doc);
    expect(math).toHaveLength(1);
    expect(math[0].type).toBe("math_display");
    expect(math[0].attrs.latex).toBe("\\int f\\,dx");
    // Make sure we didn't leave a stray codeBlock behind.
    const codeBlocks = allNodes(doc).filter((n) => n.type === "codeBlock");
    expect(codeBlocks).toHaveLength(0);
  });
});

describe("MathML output on math nodes", () => {
  test("inline math emits valid <math> with xmlns", () => {
    const doc = markdownToProseMirror("value is $\\pi$.");
    const [m] = mathNodes(doc);
    expect(m.attrs.mathml.startsWith("<math")).toBe(true);
    expect(m.attrs.mathml).toContain(
      'xmlns="http://www.w3.org/1998/Math/MathML"'
    );
  });

  test("display math emits display=\"block\"", () => {
    const doc = markdownToProseMirror("$$E = mc^2$$");
    const [m] = mathNodes(doc);
    expect(m.attrs.mathml).toContain('display="block"');
  });

  test("annotation with LaTeX source is embedded", () => {
    const doc = markdownToProseMirror("$\\alpha$");
    const [m] = mathNodes(doc);
    expect(m.attrs.mathml).toContain('encoding="application/x-tex"');
    expect(m.attrs.mathml).toContain("\\alpha");
  });

  test("malformed LaTeX produces temml-error span, not a throw", () => {
    const doc = markdownToProseMirror("broken $\\frac{$ math");
    const [m] = mathNodes(doc);
    expect(m).toBeDefined();
    expect(m.attrs.mathml).toContain("temml-error");
  });
});

describe("Mixed content paragraphs", () => {
  test("paragraph with text + inline math + text has correct structure", () => {
    const doc = markdownToProseMirror("Let $x$ be.");
    expect(doc.content).toHaveLength(1);
    const [p] = doc.content;
    expect(p.type).toBe("paragraph");
    expect(p.content.map((n) => n.type)).toEqual([
      "text",
      "math_inline",
      "text",
    ]);
  });
});
