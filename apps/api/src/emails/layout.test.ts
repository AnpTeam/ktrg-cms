import { describe, expect, test } from "bun:test";
import { escapeHtml, flattenUserText, renderHtml, renderText } from "./layout";

const parts = {
  locale: "en" as const,
  preheader: "Preview",
  heading: "Heading",
  intro: ["First.", "Second."],
  highlight: "123456",
  details: [{ label: "Name", value: "Phone" }],
  footnotes: ["Small print."],
};

describe("escapeHtml", () => {
  test("escapes markup and quotes", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("flattenUserText", () => {
  test("joins lines, trims and caps", () => {
    expect(flattenUserText(" a\r\n\tb c ")).toBe("a b c");
    expect(flattenUserText("x".repeat(100), 10)).toBe("x".repeat(10));
  });

  test("empty or missing becomes null", () => {
    expect(flattenUserText(null)).toBeNull();
    expect(flattenUserText("  \n ")).toBeNull();
  });
});

describe("renderText", () => {
  test("lays out every part in order", () => {
    expect(renderText(parts)).toBe(
      ["Heading", "", "First.", "", "Second.", "", "    123456", "", "Name: Phone", "", "Small print.", "", "--", "Katsuragi Shugen", "This mailbox is not monitored. Please do not reply."].join("\n"),
    );
  });
});

describe("renderHtml", () => {
  test("escapes every part", () => {
    const html = renderHtml({
      ...parts,
      heading: "<h>",
      details: [{ label: "Name", value: `<img src=x onerror="alert(1)">` }],
    });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<h>");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  test("sets the language and hides the preheader", () => {
    const html = renderHtml({ ...parts, locale: "ja" });
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain("このメールは送信専用です");
    expect(html).toMatch(/display:none[^>]*>Preview</);
  });
});
