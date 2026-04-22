import { App, TFile } from "obsidian";
import type {
  AuditIssue,
  AuditProgress,
  RuleRegistryLike,
  VaultAuditResult,
  VaultIndex,
} from "../types/audit";
import type { VaultHealthSettings } from "../types/settings";
import { isIgnoredPath } from "../utils/path";
import { chunkArray } from "../utils/batch";
import { SnapshotBuilder } from "./SnapshotBuilder";
import { HealthScoreService } from "../scoring/HealthScoreService";
import { AuditRepository } from "./AuditRepository";
import { Scheduler } from "./Scheduler";

export class AuditEngine {
  constructor(
    private readonly app: App,
    private readonly snapshotBuilder: SnapshotBuilder,
    private readonly ruleRegistry: RuleRegistryLike,
    private readonly scoreService: HealthScoreService,
    private readonly repository: AuditRepository,
    private readonly scheduler: Scheduler,
    private readonly settingsProvider: () => VaultHealthSettings,
    private readonly onProgress?: (progress: AuditProgress) => void,
  ) {}

  async runFullAudit(): Promise<VaultAuditResult> {
    const settings = this.settingsProvider();
    const files = this.getEligibleFiles(settings);
    const index = this.buildIndex(files);
    const result = await this.run(files, index);
    await this.repository.saveResult(result);
    return result;
  }

  async runIncrementalAudit(paths: string[]): Promise<VaultAuditResult> {
    const settings = this.settingsProvider();
    const eligibleFiles = this.getEligibleFiles(settings);
    const dirtySet = new Set(paths);
    const files = eligibleFiles.filter((file) => dirtySet.has(file.path));

    if (files.length === 0) {
      const lastResult = await this.repository.getLastResult();
      return (
        lastResult ?? {
          startedAt: Date.now(),
          finishedAt: Date.now(),
          filesScanned: 0,
          issues: [],
          breakdown: this.scoreService.calculate([], 0),
          topOffenders: [],
        }
      );
    }

    const index = this.buildIndex(eligibleFiles);
    const partialResult = await this.run(files, index);
    const previous = await this.repository.getLastResult();

    const mergedIssues = this.mergeIssues(previous?.issues ?? [], partialResult.issues, files.map((file) => file.path));
    const mergedResult: VaultAuditResult = {
      startedAt: partialResult.startedAt,
      finishedAt: partialResult.finishedAt,
      filesScanned: previous?.filesScanned ?? eligibleFiles.length,
      issues: mergedIssues,
      breakdown: this.scoreService.calculate(mergedIssues, previous?.filesScanned ?? eligibleFiles.length),
      topOffenders: this.computeTopOffenders(mergedIssues),
    };

    await this.repository.saveResult(mergedResult);
    return mergedResult;
  }

  private getEligibleFiles(settings: VaultHealthSettings): TFile[] {
    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => !isIgnoredPath(file.path, settings.ignoredFolders));
  }

  private buildIndex(files: TFile[]): VaultIndex {
    const inlinks: Record<string, number> = {};
    const outlinks: Record<string, number> = {};
    const allPaths = new Set<string>();

    for (const file of files) {
      allPaths.add(file.path);
      const cache = this.app.metadataCache.getFileCache(file);
      const links = cache?.links?.map((link) => link.link) ?? [];
      outlinks[file.path] = links.length;

      for (const link of links) {
        const destination = this.app.metadataCache.getFirstLinkpathDest(link, file.path);
        if (destination) {
          inlinks[destination.path] = (inlinks[destination.path] ?? 0) + 1;
        }
      }
    }

    return { allPaths, inlinks, outlinks };
  }

  private async run(files: TFile[], index: VaultIndex): Promise<VaultAuditResult> {
    const settings = this.settingsProvider();
    const startedAt = Date.now();
    const issues: AuditIssue[] = [];
    const rules = this.ruleRegistry.getRules(settings);
    const metadataRules = rules.filter((rule) => !rule.requiresContent);
    const contentRules = rules.filter((rule) => rule.requiresContent);
    let scanned = 0;

    for (const batch of chunkArray(files, settings.batchSize)) {
      for (const file of batch) {
        const metadataSnapshot = await this.snapshotBuilder.build(file, index, false);

        if (this.hasIgnoredTag(metadataSnapshot.tags, settings.ignoredTags)) {
          scanned += 1;
          continue;
        }

        for (const rule of metadataRules) {
          const ruleIssues = await rule.run(metadataSnapshot, {
            now: Date.now(),
            settings,
            index,
          });
          issues.push(...ruleIssues);
        }

        if (contentRules.length > 0) {
          const fullSnapshot = await this.snapshotBuilder.build(file, index, true);
          for (const rule of contentRules) {
            const ruleIssues = await rule.run(fullSnapshot, {
              now: Date.now(),
              settings,
              index,
            });
            issues.push(...ruleIssues);
          }
        }

        scanned += 1;
      }

      this.onProgress?.({
        scanned,
        total: files.length,
      });

      await this.scheduler.yield();
    }

    return {
      startedAt,
      finishedAt: Date.now(),
      filesScanned: files.length,
      issues,
      breakdown: this.scoreService.calculate(issues, files.length),
      topOffenders: this.computeTopOffenders(issues),
    };
  }

  private hasIgnoredTag(tags: string[], ignoredTags: string[]): boolean {
    const normalizedTags = new Set(tags.map((tag) => tag.toLowerCase()));
    return ignoredTags.some((tag) => normalizedTags.has(tag.toLowerCase()));
  }

  private mergeIssues(existing: AuditIssue[], incoming: AuditIssue[], touchedPaths: string[]): AuditIssue[] {
    const touched = new Set(touchedPaths);
    return [...existing.filter((issue) => !touched.has(issue.filePath)), ...incoming];
  }

  private computeTopOffenders(issues: AuditIssue[]) {
    const grouped = new Map<string, { impact: number; issueCount: number }>();

    for (const issue of issues) {
      const current = grouped.get(issue.filePath) ?? { impact: 0, issueCount: 0 };
      current.impact += issue.scoreImpact;
      current.issueCount += 1;
      grouped.set(issue.filePath, current);
    }

    return Array.from(grouped.entries())
      .map(([path, metrics]) => ({
        path,
        impact: metrics.impact,
        issueCount: metrics.issueCount,
      }))
      .sort((left, right) => right.impact - left.impact || right.issueCount - left.issueCount)
      .slice(0, 10);
  }
}
