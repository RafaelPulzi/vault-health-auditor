export function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith("---")) {
    return markdown;
  }

  const endIndex = markdown.indexOf("\n---", 3);
  if (endIndex === -1) {
    return markdown;
  }

  return markdown.slice(endIndex + 4).trimStart();
}

export function getParagraphs(markdown: string): string[] {
  return stripFrontmatter(markdown)
    .split(/\n\s*\n/g)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

export function getWordCount(markdown: string): number {
  return stripFrontmatter(markdown)
    .replace(/\[\[.*?\]\]/g, " ")
    .replace(/\[.*?\]\(.*?\)/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

export function getLineCount(markdown: string): number {
  return markdown.split(/\r?\n/).length;
}

export function hasIntroSummary(markdown: string): boolean {
  const paragraphs = getParagraphs(markdown);
  if (paragraphs.length === 0) {
    return false;
  }

  const firstParagraph = paragraphs.find((paragraph) => !paragraph.startsWith("#"));
  if (!firstParagraph) {
    return false;
  }

  if (/^summary\s*:/i.test(firstParagraph)) {
    return true;
  }

  return firstParagraph.length >= 80;
}
