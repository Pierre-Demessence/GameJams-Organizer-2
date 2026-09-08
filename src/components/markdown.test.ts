import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "@/components/markdown";

function render(md: string): string {
  return renderToStaticMarkup(createElement(Markdown, null, md));
}

describe("Markdown", () => {
  it("renders GFM tables", () => {
    const html = render("| A | B |\n| - | - |\n| 1 | 2 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>1</td>");
  });

  it("renders fenced code blocks and lists", () => {
    expect(render("```\ncode\n```")).toContain("<code");
    expect(render("- one\n- two")).toContain("<li>one</li>");
  });

  it("renders inline HTML line breaks", () => {
    expect(render("line1<br/>line2")).toContain("<br");
  });

  it("demotes headings and adds slug ids for anchors", () => {
    const html = render("## Index");
    expect(html).toContain('<h3 id="index"');
  });

  it("opens external links in a new tab but keeps hash anchors in-tab", () => {
    const external = render("[ext](https://example.com)");
    expect(external).toContain('target="_blank"');
    expect(external).toContain('rel="noopener noreferrer nofollow"');

    const anchor = render("[idx](#index)");
    expect(anchor).toContain('href="#index"');
    expect(anchor).not.toContain('target="_blank"');
  });

  it("sanitizes dangerous HTML and URLs", () => {
    expect(render("<script>alert(1)</script>")).not.toContain("<script");
    expect(render('<img src=x onerror="alert(1)">')).not.toContain("onerror");
    // Unsafe schemes must never survive as an href attribute.
    expect(render("[x](javascript:alert(1))")).not.toContain('href="javascript:');
  });

  // Mirrors the GFM cheat-sheet content from issue #33: every construct the report
  // listed as broken must render to its proper element.
  it("renders the full range of GFM constructs from the reported content", () => {
    const kitchenSink = [
      "# H1",
      "###### H6",
      "**bold** and *italic* and ~~struck~~",
      "> a block quote",
      "",
      "* bullet",
      "  1. nested ordered",
      "",
      "`inline code`",
      "",
      "```swift",
      "let x = 1",
      "```",
      "",
      "---",
      "",
      "| A | B |",
      "| :- | -: |",
      "| 1 | 2 |",
      "",
      "[GitHub](https://github.com) and ![alt](https://example.com/i.png)",
      "line one<br/>line two",
    ].join("\n");
    const html = render(kitchenSink);

    for (const tag of [
      "<h2", // # demoted from h1
      "<h6", // ###### stays h6
      "<strong>",
      "<em>",
      "<del>",
      "<blockquote>",
      "<ul>",
      "<ol>",
      "<li>",
      "<code",
      "<pre",
      "<hr",
      "<table>",
      "<th",
      "<td",
      "<a ",
      "<img",
      "<br",
    ]) {
      expect(html, `missing ${tag}`).toContain(tag);
    }
  });
});
