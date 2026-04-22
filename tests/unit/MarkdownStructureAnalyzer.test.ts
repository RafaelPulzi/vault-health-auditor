import { describe, expect, it } from "vitest";
import { MarkdownStructureAnalyzer } from "../../src/analyzers/MarkdownStructureAnalyzer";

describe("MarkdownStructureAnalyzer", () => {
  it("should detect headings and summary", () => {
    const analyzer = new MarkdownStructureAnalyzer();
    const report = analyzer.analyze(`
This is a long enough introductory summary paragraph that explains the note in a useful way.

# Heading 1

Some content.
`);

    expect(report.headingCount).toBe(1);
    expect(report.hasSummary).toBe(true);
  });
});
