import {
  getLineCount,
  getParagraphs,
  getWordCount,
  hasIntroSummary,
  stripFrontmatter,
} from "../utils/markdown";

export interface MarkdownStructureReport {
  headingCount: number;
  paragraphCount: number;
  wordCount: number;
  lineCount: number;
  hasSummary: boolean;
  paragraphDensity: number;
}

export class MarkdownStructureAnalyzer {
  analyze(markdown: string): MarkdownStructureReport {
    const stripped = stripFrontmatter(markdown);
    const lines = stripped.split(/\r?\n/);
    const paragraphs = getParagraphs(markdown);
    const headingCount = lines.filter((line) => /^#{1,6}\s+/.test(line)).length;
    const wordCount = getWordCount(markdown);
    const lineCount = getLineCount(markdown);
    const paragraphCount = paragraphs.length;
    const paragraphDensity = wordCount > 0 ? paragraphCount / wordCount : 0;

    return {
      headingCount,
      paragraphCount,
      wordCount,
      lineCount,
      hasSummary: hasIntroSummary(markdown),
      paragraphDensity,
    };
  }
}
