export interface ClaimDetectionReport {
  unsupportedClaimCount: number;
  samples: string[];
}

export class ClaimDetector {
  analyze(markdown: string): ClaimDetectionReport {
    const normalized = markdown.replace(/\r?\n/g, " ");
    const sentences = normalized
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    const unsupported = sentences.filter((sentence) => {
      if (sentence.length < 60) {
        return false;
      }

      const assertivePattern =
        /\b(Ã©|sÃ£o|deve|indica|demonstra|mostra|prova|shows|demonstrates|indicates|must|should)\b/i;
      const hasCitation =
        /\[\[.*?\]\]/.test(sentence) ||
        /\[.*?\]\(.*?\)/.test(sentence) ||
        /https?:\/\//i.test(sentence);

      return assertivePattern.test(sentence) && !hasCitation;
    });

    return {
      unsupportedClaimCount: unsupported.length,
      samples: unsupported.slice(0, 3),
    };
  }
}
