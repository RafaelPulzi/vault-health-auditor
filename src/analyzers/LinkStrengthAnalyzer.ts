export interface LinkStrengthReport {
  weakLinkCount: number;
  isolatedLinkLines: string[];
}

export class LinkStrengthAnalyzer {
  analyze(markdown: string): LinkStrengthReport {
    const lines = markdown.split(/\r?\n/);

    const isolated = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return false;
      }

      const containsLink = /\[\[.*?\]\]/.test(trimmed) || /\[.*?\]\(.*?\)/.test(trimmed);
      if (!containsLink) {
        return false;
      }

      const withoutLinks = trimmed
        .replace(/\[\[.*?\]\]/g, "")
        .replace(/\[.*?\]\(.*?\)/g, "")
        .replace(/^[-*]\s*/, "")
        .trim();

      return withoutLinks.length < 10;
    });

    return {
      weakLinkCount: isolated.length,
      isolatedLinkLines: isolated.slice(0, 5),
    };
  }
}
