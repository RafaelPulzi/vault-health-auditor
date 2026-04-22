export interface NoteSnapshot {
  path: string;
  basename: string;
  mtime: number;
  ctime: number;
  sizeBytes: number;

  links: string[];
  unresolvedLinks: string[];
  inlinksCount: number;
  outlinksCount: number;
  headings: Array<{ level: number; text: string }>;
  tags: string[];
  frontmatter: Record<string, unknown>;

  hasSummary: boolean;
  paragraphCount: number;
  wordCount: number;
  lineCount: number;
  rawContent?: string;

  noteType?: string;
  customReviewDate?: number | null;
}
