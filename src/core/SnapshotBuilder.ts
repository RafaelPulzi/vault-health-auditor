import { App, TFile } from "obsidian";
import type { VaultIndex } from "../types/audit";
import type { NoteSnapshot } from "../types/snapshot";
import type { VaultHealthSettings } from "../types/settings";
import { MarkdownStructureAnalyzer } from "../analyzers/MarkdownStructureAnalyzer";
import { parseDateLike } from "../utils/time";

export class SnapshotBuilder {
  private readonly structureAnalyzer = new MarkdownStructureAnalyzer();

  constructor(
    private readonly app: App,
    private readonly settingsProvider: () => VaultHealthSettings,
  ) {}

  async build(file: TFile, index: VaultIndex, includeContent: boolean): Promise<NoteSnapshot> {
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = (cache?.frontmatter ?? {}) as Record<string, unknown>;
    const reviewField = this.settingsProvider().customReviewField;
    const rawContent = includeContent ? await this.app.vault.cachedRead(file) : undefined;

    const structure = rawContent
      ? this.structureAnalyzer.analyze(rawContent)
      : {
          headingCount: cache?.headings?.length ?? 0,
          paragraphCount: 0,
          wordCount: 0,
          lineCount: 0,
          hasSummary: Boolean(frontmatter.summary),
          paragraphDensity: 0,
        };

    const unresolvedMap = (this.app.metadataCache.unresolvedLinks as Record<string, Record<string, number>> | undefined) ?? {};

    return {
      path: file.path,
      basename: file.basename,
      mtime: file.stat.mtime,
      ctime: file.stat.ctime,
      sizeBytes: file.stat.size,
      links: cache?.links?.map((link) => link.link) ?? [],
      unresolvedLinks: Object.keys(unresolvedMap[file.path] ?? {}),
      inlinksCount: index.inlinks[file.path] ?? 0,
      outlinksCount: index.outlinks[file.path] ?? 0,
      headings:
        cache?.headings?.map((item) => ({
          level: item.level,
          text: item.heading,
        })) ?? [],
      tags: cache?.tags?.map((tag) => tag.tag.replace(/^#/, "")) ?? [],
      frontmatter,
      hasSummary: structure.hasSummary || Boolean(frontmatter.summary),
      paragraphCount: structure.paragraphCount,
      wordCount: structure.wordCount,
      lineCount: structure.lineCount,
      rawContent,
      noteType:
        typeof frontmatter.type === "string"
          ? frontmatter.type
          : typeof frontmatter.note_type === "string"
            ? frontmatter.note_type
            : undefined,
      customReviewDate: parseDateLike(frontmatter[reviewField]),
    };
  }
}
