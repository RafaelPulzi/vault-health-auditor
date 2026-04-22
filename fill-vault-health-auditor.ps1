# ============================================================
# fill-vault-health-auditor.ps1
# Gera conteúdo inicial funcional para todo o projeto
# ============================================================

Set-Location "vault-health-auditor"

function Write-Utf8File {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $dir = Split-Path -Parent $Path
    if ($dir) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }

    Set-Content -Path $Path -Value $Content -Encoding UTF8
}

Write-Utf8File "src/types/audit.ts" @'
import type { NoteSnapshot } from "./snapshot";
import type { VaultHealthSettings } from "./settings";
import type { HealthScoreBreakdown, HealthCategory } from "./score";

export type AuditSeverity = "info" | "warning" | "error" | "critical";

export type AuditRuleId =
  | "note-age"
  | "broken-links"
  | "orphan-note"
  | "required-frontmatter"
  | "large-unstructured-note"
  | "dump-page"
  | "missing-summary"
  | "unsupported-claims";

export interface AuditIssue {
  ruleId: AuditRuleId;
  severity: AuditSeverity;
  category: HealthCategory;
  filePath: string;
  title: string;
  message: string;
  evidence?: string[];
  scoreImpact: number;
  autofixable?: boolean;
  metadata?: Record<string, unknown>;
}

export interface VaultIndex {
  allPaths: Set<string>;
  inlinks: Record<string, number>;
  outlinks: Record<string, number>;
}

export interface AuditRuleContext {
  now: number;
  settings: VaultHealthSettings;
  index: VaultIndex;
}

export interface AuditRule {
  id: AuditRuleId;
  name: string;
  description: string;
  requiresContent?: boolean;
  run(
    snapshot: NoteSnapshot,
    ctx: AuditRuleContext,
  ): Promise<AuditIssue[]> | AuditIssue[];
}

export interface TopOffender {
  path: string;
  impact: number;
  issueCount: number;
}

export interface VaultAuditResult {
  startedAt: number;
  finishedAt: number;
  filesScanned: number;
  issues: AuditIssue[];
  breakdown: HealthScoreBreakdown;
  topOffenders: TopOffender[];
}

export interface AuditProgress {
  scanned: number;
  total: number;
}

export interface RuleRegistryLike {
  getRules(settings: VaultHealthSettings): AuditRule[];
}
'@

Write-Utf8File "src/types/score.ts" @'
import type { AuditSeverity } from "./audit";

export type HealthCategory =
  | "freshness"
  | "links"
  | "structure"
  | "metadata"
  | "knowledge-quality";

export interface HealthScoreBreakdown {
  total: number;
  byCategory: Record<HealthCategory, number>;
  penaltyPoints: number;
  issueCountBySeverity: Record<AuditSeverity, number>;
}
'@

Write-Utf8File "src/types/settings.ts" @'
import type { AuditRuleId } from "./audit";

export interface NoteTypePolicy {
  noteType: string;
  requiredFrontmatter: string[];
  summaryRequired: boolean;
  staleAfterDays: number;
}

export interface VaultHealthSettings {
  enabledRules: AuditRuleId[];
  noteTypePolicies: NoteTypePolicy[];
  ignoredFolders: string[];
  ignoredTags: string[];
  largeNoteWordThreshold: number;
  dumpPageLinkThreshold: number;
  dumpPageParagraphDensityMin: number;
  fullAuditOnStartup: boolean;
  maxConcurrentReads: number;
  batchSize: number;
  customReviewField: string;
}
'@

Write-Utf8File "src/types/snapshot.ts" @'
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
'@

Write-Utf8File "src/constants.ts" @'
import type { VaultHealthSettings } from "./types/settings";

export const PLUGIN_ID = "vault-health-auditor";
export const PLUGIN_NAME = "Vault Health Auditor";
export const VIEW_TYPE_DASHBOARD = "vault-health-auditor-dashboard";

export const DEFAULT_SETTINGS: VaultHealthSettings = {
  enabledRules: [
    "note-age",
    "broken-links",
    "orphan-note",
    "required-frontmatter",
    "large-unstructured-note",
    "dump-page",
    "missing-summary",
    "unsupported-claims",
  ],
  noteTypePolicies: [
    {
      noteType: "book",
      requiredFrontmatter: ["author", "year", "status"],
      summaryRequired: true,
      staleAfterDays: 90,
    },
    {
      noteType: "article",
      requiredFrontmatter: ["author", "source", "published"],
      summaryRequired: true,
      staleAfterDays: 60,
    },
    {
      noteType: "permanent",
      requiredFrontmatter: ["summary"],
      summaryRequired: true,
      staleAfterDays: 120,
    },
    {
      noteType: "fleeting",
      requiredFrontmatter: [],
      summaryRequired: false,
      staleAfterDays: 14,
    },
  ],
  ignoredFolders: [".obsidian", "Templates"],
  ignoredTags: ["no-audit"],
  largeNoteWordThreshold: 1200,
  dumpPageLinkThreshold: 35,
  dumpPageParagraphDensityMin: 0.18,
  fullAuditOnStartup: false,
  maxConcurrentReads: 4,
  batchSize: 75,
  customReviewField: "reviewed_at",
};
'@

Write-Utf8File "src/utils/markdown.ts" @'
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
  const words = stripFrontmatter(markdown)
    .replace(/\[\[.*?\]\]/g, " ")
    .replace(/\[.*?\]\(.*?\)/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  return words.length;
}

export function getLineCount(markdown: string): number {
  return markdown.split(/\r?\n/).length;
}

export function hasIntroSummary(markdown: string): boolean {
  const paragraphs = getParagraphs(markdown);
  if (paragraphs.length === 0) {
    return false;
  }

  const first = paragraphs.find((p) => !p.startsWith("#"));
  if (!first) {
    return false;
  }

  if (/^summary\s*:/i.test(first)) {
    return true;
  }

  return first.length >= 80;
}
'@

Write-Utf8File "src/utils/time.ts" @'
export const DAY_MS = 1000 * 60 * 60 * 24;

export function parseDateLike(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

export function diffDays(fromTimestamp: number, toTimestamp: number): number {
  return Math.floor((toTimestamp - fromTimestamp) / DAY_MS);
}
'@

Write-Utf8File "src/utils/path.ts" @'
export function normalizePathLike(input: string): string {
  return input.replace(/\\/g, "/").trim();
}

export function isIgnoredPath(path: string, ignoredFolders: string[]): boolean {
  const normalized = normalizePathLike(path).toLowerCase();

  return ignoredFolders.some((folder) => {
    const test = normalizePathLike(folder).toLowerCase();
    return normalized === test || normalized.startsWith(`${test}/`);
  });
}
'@

Write-Utf8File "src/utils/batch.ts" @'
export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}
'@

Write-Utf8File "src/utils/logger.ts" @'
export const logger = {
  info: (...args: unknown[]) => console.info("[VaultHealthAuditor]", ...args),
  warn: (...args: unknown[]) => console.warn("[VaultHealthAuditor]", ...args),
  error: (...args: unknown[]) => console.error("[VaultHealthAuditor]", ...args),
};
'@

Write-Utf8File "src/analyzers/MarkdownStructureAnalyzer.ts" @'
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
    const paragraphs = getParagraphs(markdown);
    const lines = stripped.split(/\r?\n/);
    const headingCount = lines.filter((line) => /^#{1,6}\s+/.test(line)).length;
    const wordCount = getWordCount(markdown);
    const lineCount = getLineCount(markdown);
    const paragraphCount = paragraphs.length;
    const paragraphDensity =
      wordCount > 0 ? Number((paragraphCount / wordCount).toFixed(4)) : 0;

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
'@

Write-Utf8File "src/analyzers/LinkStrengthAnalyzer.ts" @'
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

      const containsLink =
        /\[\[.*?\]\]/.test(trimmed) || /\[.*?\]\(.*?\)/.test(trimmed);
      if (!containsLink) {
        return false;
      }

      const noLinks = trimmed
        .replace(/\[\[.*?\]\]/g, "")
        .replace(/\[.*?\]\(.*?\)/g, "")
        .replace(/^[-*]\s*/, "")
        .trim();

      return noLinks.length < 10;
    });

    return {
      weakLinkCount: isolated.length,
      isolatedLinkLines: isolated.slice(0, 5),
    };
  }
}
'@

Write-Utf8File "src/analyzers/ClaimDetector.ts" @'
export interface ClaimDetectionReport {
  unsupportedClaimCount: number;
  samples: string[];
}

export class ClaimDetector {
  analyze(markdown: string): ClaimDetectionReport {
    const normalized = markdown.replace(/\r?\n/g, " ");
    const sentences = normalized
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const unsupported = sentences.filter((sentence) => {
      if (sentence.length < 60) {
        return false;
      }

      const assertivePattern =
        /\b(é|são|deve|indica|demonstra|mostra|prova|shows|demonstrates|indicates|must|should)\b/i;
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
'@

Write-Utf8File "src/analyzers/FrontmatterPolicyMatcher.ts" @'
import type { NoteTypePolicy } from "../types/settings";

export class FrontmatterPolicyMatcher {
  constructor(private readonly policies: NoteTypePolicy[]) {}

  resolvePolicy(noteType?: string): NoteTypePolicy | undefined {
    if (!noteType) {
      return undefined;
    }

    return this.policies.find(
      (policy) => policy.noteType.toLowerCase() === noteType.toLowerCase(),
    );
  }

  missingFields(
    frontmatter: Record<string, unknown>,
    noteType?: string,
  ): string[] {
    const policy = this.resolvePolicy(noteType);
    if (!policy) {
      return [];
    }

    return policy.requiredFrontmatter.filter((field) => {
      const value = frontmatter[field];
      if (value == null) {
        return true;
      }

      if (typeof value === "string") {
        return value.trim().length === 0;
      }

      if (Array.isArray(value)) {
        return value.length === 0;
      }

      return false;
    });
  }
}
'@

Write-Utf8File "src/scoring/ScoreWeights.ts" @'
import type { AuditRuleId, AuditSeverity } from "../types/audit";

export const RULE_WEIGHTS: Record<AuditRuleId, number> = {
  "note-age": 1.1,
  "broken-links": 2.0,
  "orphan-note": 1.4,
  "required-frontmatter": 1.2,
  "large-unstructured-note": 1.5,
  "dump-page": 1.8,
  "missing-summary": 1.0,
  "unsupported-claims": 2.2,
};

export const SEVERITY_MULTIPLIER: Record<AuditSeverity, number> = {
  info: 0.5,
  warning: 1.0,
  error: 1.75,
  critical: 2.5,
};
'@

Write-Utf8File "src/scoring/HealthScoreService.ts" @'
import type { AuditIssue } from "../types/audit";
import type { HealthCategory, HealthScoreBreakdown } from "../types/score";
import { RULE_WEIGHTS, SEVERITY_MULTIPLIER } from "./ScoreWeights";

const CATEGORIES: HealthCategory[] = [
  "freshness",
  "links",
  "structure",
  "metadata",
  "knowledge-quality",
];

export class HealthScoreService {
  calculate(issues: AuditIssue[], filesScanned: number): HealthScoreBreakdown {
    const penaltiesByCategory = {
      freshness: 0,
      links: 0,
      structure: 0,
      metadata: 0,
      "knowledge-quality": 0,
    };

    const issueCountBySeverity = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    let totalPenalty = 0;

    for (const issue of issues) {
      const weighted =
        issue.scoreImpact *
        RULE_WEIGHTS[issue.ruleId] *
        SEVERITY_MULTIPLIER[issue.severity];

      penaltiesByCategory[issue.category] += weighted;
      issueCountBySeverity[issue.severity] += 1;
      totalPenalty += weighted;
    }

    const normalizedPenalty =
      filesScanned > 0 ? (totalPenalty / filesScanned) * 5 : totalPenalty;
    const total = Math.max(0, Math.min(100, Math.round(100 - normalizedPenalty)));

    const byCategory = Object.fromEntries(
      CATEGORIES.map((category) => {
        const categoryPenalty =
          filesScanned > 0 ? (penaltiesByCategory[category] / filesScanned) * 8 : 0;
        const score = Math.max(0, Math.min(100, Math.round(100 - categoryPenalty)));
        return [category, score];
      }),
    ) as HealthScoreBreakdown["byCategory"];

    return {
      total,
      byCategory,
      penaltyPoints: Number(totalPenalty.toFixed(2)),
      issueCountBySeverity,
    };
  }
}
'@

Write-Utf8File "src/core/Scheduler.ts" @'
export class Scheduler {
  async yield(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => resolve());
        return;
      }

      setTimeout(() => resolve(), 0);
    });
  }
}
'@

Write-Utf8File "src/core/IncrementalIndexer.ts" @'
export class IncrementalIndexer {
  private readonly dirtyPaths = new Set<string>();

  markDirty(path: string): void {
    this.dirtyPaths.add(path);
  }

  markDeleted(path: string): void {
    this.dirtyPaths.add(path);
  }

  clear(): void {
    this.dirtyPaths.clear();
  }

  consumeDirty(): string[] {
    const paths = Array.from(this.dirtyPaths);
    this.dirtyPaths.clear();
    return paths;
  }
}
'@

Write-Utf8File "src/core/SnapshotBuilder.ts" @'
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

  async build(
    file: TFile,
    index: VaultIndex,
    includeContent: boolean,
  ): Promise<NoteSnapshot> {
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

    const unresolvedMap = (this.app.metadataCache.unresolvedLinks as Record<
      string,
      Record<string, number>
    > | undefined) ?? {};


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
      headings: cache?.headings?.map((item) => ({
        level: item.level,
        text: item.heading,
      })) ?? [],
      tags:
        cache?.tags?.map((tag) => tag.tag.replace(/^#/, "")) ??
        [],
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
'@

Write-Utf8File "src/core/RuleRegistry.ts" @'
import type { AuditRule } from "../types/audit";
import type { VaultHealthSettings } from "../types/settings";
import { NoteAgeRule } from "../rules/NoteAgeRule";
import { BrokenLinksRule } from "../rules/BrokenLinksRule";
import { OrphanNoteRule } from "../rules/OrphanNoteRule";
import { RequiredFrontmatterRule } from "../rules/RequiredFrontmatterRule";
import { LargeUnstructuredNoteRule } from "../rules/LargeUnstructuredNoteRule";
import { DumpPageRule } from "../rules/DumpPageRule";
import { MissingSummaryRule } from "../rules/MissingSummaryRule";
import { UnsupportedClaimsRule } from "../rules/UnsupportedClaimsRule";

export class RuleRegistry {
  private readonly rules: AuditRule[] = [
    new NoteAgeRule(),
    new BrokenLinksRule(),
    new OrphanNoteRule(),
    new RequiredFrontmatterRule(),
    new LargeUnstructuredNoteRule(),
    new DumpPageRule(),
    new MissingSummaryRule(),
    new UnsupportedClaimsRule(),
  ];

  getRules(settings: VaultHealthSettings): AuditRule[] {
    return this.rules.filter((rule) => settings.enabledRules.includes(rule.id));
  }
}
'@

Write-Utf8File "src/persistence/storageSchema.ts" @'
import { DEFAULT_SETTINGS } from "../constants";
import type { VaultAuditResult } from "../types/audit";
import type { VaultHealthSettings } from "../types/settings";

export interface StoredAuditHistoryEntry {
  timestamp: number;
  total: number;
  issueCount: number;
  filesScanned: number;
}

export interface StoredAuditData {
  lastResult: VaultAuditResult | null;
  history: StoredAuditHistoryEntry[];
}

export interface PluginStorageData {
  settings: VaultHealthSettings;
  audit: StoredAuditData;
}

export const DEFAULT_STORAGE_DATA: PluginStorageData = {
  settings: DEFAULT_SETTINGS,
  audit: {
    lastResult: null,
    history: [],
  },
};
'@

Write-Utf8File "src/persistence/dataMappers.ts" @'
import type { VaultAuditResult } from "../types/audit";
import type { StoredAuditHistoryEntry } from "./storageSchema";

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function toHistoryEntry(result: VaultAuditResult): StoredAuditHistoryEntry {
  return {
    timestamp: result.finishedAt,
    total: result.breakdown.total,
    issueCount: result.issues.length,
    filesScanned: result.filesScanned,
  };
}
'@

Write-Utf8File "src/core/AuditRepository.ts" @'
import type { Plugin } from "obsidian";
import { DEFAULT_SETTINGS } from "../constants";
import type { VaultAuditResult } from "../types/audit";
import type { VaultHealthSettings } from "../types/settings";
import { deepClone, toHistoryEntry } from "../persistence/dataMappers";
import {
  DEFAULT_STORAGE_DATA,
  type PluginStorageData,
  type StoredAuditHistoryEntry,
} from "../persistence/storageSchema";

export class AuditRepository {
  constructor(private readonly plugin: Plugin) {}

  private async read(): Promise<PluginStorageData> {
    const raw = await this.plugin.loadData();

    return {
      settings: {
        ...DEFAULT_SETTINGS,
        ...(raw?.settings ?? {}),
      },
      audit: {
        lastResult: raw?.audit?.lastResult ?? DEFAULT_STORAGE_DATA.audit.lastResult,
        history: raw?.audit?.history ?? DEFAULT_STORAGE_DATA.audit.history,
      },
    };
  }

  async getSettings(fallback: VaultHealthSettings = DEFAULT_SETTINGS): Promise<VaultHealthSettings> {
    const data = await this.read();
    return {
      ...fallback,
      ...deepClone(data.settings),
    };
  }

  async saveSettings(settings: VaultHealthSettings): Promise<void> {
    const data = await this.read();
    data.settings = deepClone(settings);
    await this.plugin.saveData(data);
  }

  async getLastResult(): Promise<VaultAuditResult | null> {
    const data = await this.read();
    return data.audit.lastResult ? deepClone(data.audit.lastResult) : null;
  }

  async getHistory(): Promise<StoredAuditHistoryEntry[]> {
    const data = await this.read();
    return deepClone(data.audit.history);
  }

  async saveResult(result: VaultAuditResult): Promise<void> {
    const data = await this.read();
    data.audit.lastResult = deepClone(result);
    data.audit.history = [...data.audit.history, toHistoryEntry(result)].slice(-30);
    await this.plugin.saveData(data);
  }
}
'@

Write-Utf8File "src/rules/NoteAgeRule.ts" @'
import type { AuditIssue, AuditRule } from "../types/audit";
import { FrontmatterPolicyMatcher } from "../analyzers/FrontmatterPolicyMatcher";
import { diffDays } from "../utils/time";

export class NoteAgeRule implements AuditRule {
  readonly id = "note-age" as const;
  readonly name = "Stale note";
  readonly description = "Detects notes that have not been reviewed recently.";

  run(snapshot, ctx): AuditIssue[] {
    const matcher = new FrontmatterPolicyMatcher(ctx.settings.noteTypePolicies);
    const policy = matcher.resolvePolicy(snapshot.noteType);
    const staleAfterDays = policy?.staleAfterDays ?? 45;

    const referenceTimestamp = snapshot.customReviewDate ?? snapshot.mtime;
    const ageDays = diffDays(referenceTimestamp, ctx.now);

    if (ageDays <= staleAfterDays) {
      return [];
    }

    const severity =
      ageDays > staleAfterDays * 2 ? "error" : "warning";

    return [
      {
        ruleId: this.id,
        severity,
        category: "freshness",
        filePath: snapshot.path,
        title: "Nota sem revisão recente",
        message: `A nota está há ${ageDays} dias sem revisão. Limite configurado: ${staleAfterDays} dias.`,
        scoreImpact: severity === "error" ? 3 : 2,
        metadata: {
          ageDays,
          staleAfterDays,
        },
      },
    ];
  }
}
'@

Write-Utf8File "src/rules/BrokenLinksRule.ts" @'
import type { AuditIssue, AuditRule } from "../types/audit";
import { LinkStrengthAnalyzer } from "../analyzers/LinkStrengthAnalyzer";

export class BrokenLinksRule implements AuditRule {
  readonly id = "broken-links" as const;
  readonly name = "Broken or weak links";
  readonly description = "Detects unresolved links and weak link context.";

  run(snapshot): AuditIssue[] {
    const issues: AuditIssue[] = [];

    if (snapshot.unresolvedLinks.length > 0) {
      issues.push({
        ruleId: this.id,
        severity: "error",
        category: "links",
        filePath: snapshot.path,
        title: "Links quebrados encontrados",
        message: `A nota possui ${snapshot.unresolvedLinks.length} link(s) sem resolução.`,
        evidence: snapshot.unresolvedLinks.slice(0, 5),
        scoreImpact: 4,
      });
    }

    if (snapshot.rawContent) {
      const strength = new LinkStrengthAnalyzer().analyze(snapshot.rawContent);
      if (strength.weakLinkCount > 0) {
        issues.push({
          ruleId: this.id,
          severity: "warning",
          category: "links",
          filePath: snapshot.path,
          title: "Links fracos ou isolados",
          message: `Foram encontradas ${strength.weakLinkCount} linha(s) com links sem contexto suficiente.`,
          evidence: strength.isolatedLinkLines,
          scoreImpact: 2,
        });
      }
    }

    return issues;
  }
}
'@

Write-Utf8File "src/rules/OrphanNoteRule.ts" @'
import type { AuditIssue, AuditRule } from "../types/audit";

export class OrphanNoteRule implements AuditRule {
  readonly id = "orphan-note" as const;
  readonly name = "Orphan note";
  readonly description = "Detects notes without inlinks and outlinks.";

  run(snapshot): AuditIssue[] {
    if (snapshot.inlinksCount > 0 || snapshot.outlinksCount > 0) {
      return [];
    }

    return [
      {
        ruleId: this.id,
        severity: "warning",
        category: "links",
        filePath: snapshot.path,
        title: "Nota órfã",
        message: "A nota não possui inlinks nem outlinks.",
        scoreImpact: 2,
      },
    ];
  }
}
'@

Write-Utf8File "src/rules/RequiredFrontmatterRule.ts" @'
import type { AuditIssue, AuditRule } from "../types/audit";
import { FrontmatterPolicyMatcher } from "../analyzers/FrontmatterPolicyMatcher";

export class RequiredFrontmatterRule implements AuditRule {
  readonly id = "required-frontmatter" as const;
  readonly name = "Required frontmatter";
  readonly description = "Checks mandatory frontmatter based on note type.";

  run(snapshot, ctx): AuditIssue[] {
    const matcher = new FrontmatterPolicyMatcher(ctx.settings.noteTypePolicies);
    const missing = matcher.missingFields(snapshot.frontmatter, snapshot.noteType);

    if (missing.length === 0) {
      return [];
    }

    return [
      {
        ruleId: this.id,
        severity: "warning",
        category: "metadata",
        filePath: snapshot.path,
        title: "Frontmatter obrigatório ausente",
        message: `Campos ausentes para o tipo "${snapshot.noteType ?? "desconhecido"}": ${missing.join(", ")}.`,
        evidence: missing,
        scoreImpact: 2,
        autofixable: false,
      },
    ];
  }
}
'@

Write-Utf8File "src/rules/LargeUnstructuredNoteRule.ts" @'
import type { AuditIssue, AuditRule } from "../types/audit";

export class LargeUnstructuredNoteRule implements AuditRule {
  readonly id = "large-unstructured-note" as const;
  readonly name = "Large unstructured note";
  readonly description = "Detects long notes with poor heading structure.";
  readonly requiresContent = true;

  run(snapshot, ctx): AuditIssue[] {
    if (!snapshot.rawContent) {
      return [];
    }

    if (snapshot.wordCount < ctx.settings.largeNoteWordThreshold) {
      return [];
    }

    if (snapshot.headings.length >= 2) {
      return [];
    }

    return [
      {
        ruleId: this.id,
        severity: "warning",
        category: "structure",
        filePath: snapshot.path,
        title: "Nota grande sem estrutura suficiente",
        message: `A nota possui ${snapshot.wordCount} palavras e apenas ${snapshot.headings.length} heading(s).`,
        scoreImpact: 3,
      },
    ];
  }
}
'@

Write-Utf8File "src/rules/DumpPageRule.ts" @'
import type { AuditIssue, AuditRule } from "../types/audit";

export class DumpPageRule implements AuditRule {
  readonly id = "dump-page" as const;
  readonly name = "Dump page";
  readonly description = "Detects notes that look like unstructured dumping grounds.";
  readonly requiresContent = true;

  run(snapshot, ctx): AuditIssue[] {
    if (!snapshot.rawContent) {
      return [];
    }

    const tooManyLinks = snapshot.links.length >= ctx.settings.dumpPageLinkThreshold;
    const weakParagraphDensity =
      snapshot.wordCount > 0
        ? snapshot.paragraphCount / snapshot.wordCount < ctx.settings.dumpPageParagraphDensityMin / 100
        : false;

    if (!tooManyLinks && !weakParagraphDensity) {
      return [];
    }

    return [
      {
        ruleId: this.id,
        severity: "warning",
        category: "structure",
        filePath: snapshot.path,
        title: "Página com característica de depósito",
        message: `A nota tem ${snapshot.links.length} links e ${snapshot.paragraphCount} parágrafo(s), sugerindo acúmulo sem curadoria.`,
        scoreImpact: 3,
      },
    ];
  }
}
'@

Write-Utf8File "src/rules/MissingSummaryRule.ts" @'
import type { AuditIssue, AuditRule } from "../types/audit";
import { FrontmatterPolicyMatcher } from "../analyzers/FrontmatterPolicyMatcher";

export class MissingSummaryRule implements AuditRule {
  readonly id = "missing-summary" as const;
  readonly name = "Missing summary";
  readonly description = "Checks if notes that require summary actually have one.";
  readonly requiresContent = true;

  run(snapshot, ctx): AuditIssue[] {
    const matcher = new FrontmatterPolicyMatcher(ctx.settings.noteTypePolicies);
    const policy = matcher.resolvePolicy(snapshot.noteType);

    if (!policy?.summaryRequired) {
      return [];
    }

    if (snapshot.hasSummary) {
      return [];
    }

    return [
      {
        ruleId: this.id,
        severity: "warning",
        category: "knowledge-quality",
        filePath: snapshot.path,
        title: "Resumo ausente",
        message: `Notas do tipo "${snapshot.noteType}" exigem resumo, mas nenhum foi detectado.`,
        scoreImpact: 2,
      },
    ];
  }
}
'@

Write-Utf8File "src/rules/UnsupportedClaimsRule.ts" @'
import type { AuditIssue, AuditRule } from "../types/audit";
import { ClaimDetector } from "../analyzers/ClaimDetector";

export class UnsupportedClaimsRule implements AuditRule {
  readonly id = "unsupported-claims" as const;
  readonly name = "Unsupported claims";
  readonly description = "Flags assertive claims without nearby references.";
  readonly requiresContent = true;

  run(snapshot): AuditIssue[] {
    if (!snapshot.rawContent) {
      return [];
    }

    const report = new ClaimDetector().analyze(snapshot.rawContent);
    if (report.unsupportedClaimCount === 0) {
      return [];
    }

    return [
      {
        ruleId: this.id,
        severity: "warning",
        category: "knowledge-quality",
        filePath: snapshot.path,
        title: "Claims sem suporte detectados",
        message: `Foram encontradas ${report.unsupportedClaimCount} afirmações potencialmente sem fonte.`,
        evidence: report.samples,
        scoreImpact: 3,
      },
    ];
  }
}
'@

Write-Utf8File "src/core/AuditEngine.ts" @'
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
import { FrontmatterPolicyMatcher } from "../analyzers/FrontmatterPolicyMatcher";

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
    return this.run(files, index);
  }

  async runIncrementalAudit(paths: string[]): Promise<VaultAuditResult> {
    const settings = this.settingsProvider();
    const eligible = this.getEligibleFiles(settings);
    const pathSet = new Set(paths);
    const files = eligible.filter((file) => pathSet.has(file.path));

    if (files.length === 0) {
      const previous = await this.repository.getLastResult();
      if (previous) {
        return previous;
      }

      return {
        startedAt: Date.now(),
        finishedAt: Date.now(),
        filesScanned: 0,
        issues: [],
        breakdown: this.scoreService.calculate([], 0),
        topOffenders: [],
      };
    }

    const index = this.buildIndex(eligible);
    return this.run(files, index);
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
    const matcher = new FrontmatterPolicyMatcher(settings.noteTypePolicies);

    let scanned = 0;

    for (const batch of chunkArray(files, settings.batchSize)) {
      for (const file of batch) {
        const metadataSnapshot = await this.snapshotBuilder.build(file, index, false);

        for (const rule of metadataRules) {
          const result = await rule.run(metadataSnapshot, {
            now: Date.now(),
            settings,
            index,
          });
          issues.push(...result);
        }

        const shouldReadContent =
          contentRules.length > 0 &&
          (
            metadataSnapshot.sizeBytes > 1024 ||
            metadataSnapshot.links.length > 0 ||
            Boolean(matcher.resolvePolicy(metadataSnapshot.noteType)?.summaryRequired)
          );

        if (shouldReadContent) {
          const fullSnapshot = await this.snapshotBuilder.build(file, index, true);

          for (const rule of contentRules) {
            const result = await rule.run(fullSnapshot, {
              now: Date.now(),
              settings,
              index,
            });
            issues.push(...result);
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

    const breakdown = this.scoreService.calculate(issues, files.length);
    const result: VaultAuditResult = {
      startedAt,
      finishedAt: Date.now(),
      filesScanned: files.length,
      issues,
      breakdown,
      topOffenders: this.computeTopOffenders(issues),
    };

    await this.repository.saveResult(result);
    return result;
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
      .map(([path, value]) => ({
        path,
        impact: value.impact,
        issueCount: value.issueCount,
      }))
      .sort((a, b) => b.impact - a.impact || b.issueCount - a.issueCount)
      .slice(0, 10);
  }
}
'@

Write-Utf8File "src/ui/views/viewType.ts" @'
export const DASHBOARD_VIEW_TYPE = "vault-health-auditor-dashboard";
'@

Write-Utf8File "src/ui/views/DashboardView.ts" @'
import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { PLUGIN_NAME, VIEW_TYPE_DASHBOARD } from "../../constants";
import type VaultHealthAuditorPlugin from "../../main";

export class DashboardView extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: VaultHealthAuditorPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_DASHBOARD;
  }

  getDisplayText(): string {
    return PLUGIN_NAME;
  }

  getIcon(): string {
    return "activity";
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async render(): Promise<void> {
    const result = await this.plugin.repository.getLastResult();
    const history = await this.plugin.repository.getHistory();

    this.contentEl.empty();
    this.contentEl.addClass("vha-dashboard");

    const header = this.contentEl.createDiv({ cls: "vha-header" });
    header.createEl("h2", { text: "Vault Health Auditor" });

    const actionRow = header.createDiv({ cls: "vha-actions" });
    const fullAuditButton = actionRow.createEl("button", {
      text: "Run full audit",
      cls: "mod-cta",
    });
    fullAuditButton.addEventListener("click", async () => {
      await this.plugin.runFullAudit();
      await this.render();
    });

    const incrementalButton = actionRow.createEl("button", {
      text: "Run incremental audit",
    });
    incrementalButton.addEventListener("click", async () => {
      await this.plugin.runIncrementalAudit();
      await this.render();
    });

    if (!result) {
      this.contentEl.createEl("p", {
        text: "Nenhuma auditoria foi executada ainda. Rode um full audit para gerar os primeiros resultados.",
      });
      return;
    }

    const cards = this.contentEl.createDiv({ cls: "vha-cards" });
    this.createCard(cards, "Health Score", String(result.breakdown.total));
    this.createCard(cards, "Files scanned", String(result.filesScanned));
    this.createCard(cards, "Issues found", String(result.issues.length));
    this.createCard(
      cards,
      "Progress",
      `${this.plugin.progress.scanned}/${this.plugin.progress.total}`,
    );

    const severity = this.contentEl.createDiv({ cls: "vha-block" });
    severity.createEl("h3", { text: "Severity breakdown" });
    severity.createEl("pre", {
      text: JSON.stringify(result.breakdown.issueCountBySeverity, null, 2),
    });

    const category = this.contentEl.createDiv({ cls: "vha-block" });
    category.createEl("h3", { text: "Category scores" });
    category.createEl("pre", {
      text: JSON.stringify(result.breakdown.byCategory, null, 2),
    });

    const offenders = this.contentEl.createDiv({ cls: "vha-block" });
    offenders.createEl("h3", { text: "Top offenders" });
    if (result.topOffenders.length === 0) {
      offenders.createEl("p", { text: "Sem destaques negativos no momento." });
    } else {
      const list = offenders.createEl("ol");
      for (const item of result.topOffenders) {
        list.createEl("li", {
          text: `${item.path} — impact ${item.impact} / ${item.issueCount} issue(s)`,
        });
      }
    }

    const issuesBlock = this.contentEl.createDiv({ cls: "vha-block" });
    issuesBlock.createEl("h3", { text: "Recent issues" });

    if (result.issues.length === 0) {
      issuesBlock.createEl("p", { text: "Nenhuma issue encontrada." });
    } else {
      const list = issuesBlock.createDiv({ cls: "vha-issues" });
      for (const issue of result.issues.slice(0, 50)) {
        const item = list.createDiv({ cls: `vha-issue vha-${issue.severity}` });
        item.createEl("strong", {
          text: `[${issue.severity.toUpperCase()}] ${issue.title}`,
        });
        item.createEl("div", { text: issue.filePath });
        item.createEl("p", { text: issue.message });

        if (issue.evidence?.length) {
          item.createEl("pre", { text: issue.evidence.join("\n") });
        }
      }
    }

    const historyBlock = this.contentEl.createDiv({ cls: "vha-block" });
    historyBlock.createEl("h3", { text: "History" });

    if (history.length === 0) {
      historyBlock.createEl("p", { text: "Ainda não há histórico persistido." });
    } else {
      const list = historyBlock.createEl("ul");
      for (const entry of history.slice(-10).reverse()) {
        list.createEl("li", {
          text: `${new Date(entry.timestamp).toLocaleString()} — score ${entry.total}, issues ${entry.issueCount}, files ${entry.filesScanned}`,
        });
      }
    }
  }

  private createCard(container: HTMLElement, title: string, value: string): void {
    const card = container.createDiv({ cls: "vha-card" });
    card.createEl("small", { text: title });
    card.createEl("h3", { text: value });
  }

  async onClose(): Promise<void> {
    new Notice("Vault Health Auditor dashboard fechado.");
  }
}
'@

Write-Utf8File "src/ui/settings/VaultHealthSettingTab.ts" @'
import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type VaultHealthAuditorPlugin from "../../main";

export class VaultHealthSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: VaultHealthAuditorPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Vault Health Auditor settings" });

    new Setting(containerEl)
      .setName("Run full audit on startup")
      .setDesc("Executa uma auditoria completa sempre que o Obsidian iniciar.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.fullAuditOnStartup)
          .onChange(async (value) => {
            this.plugin.settings.fullAuditOnStartup = value;
            await this.plugin.savePluginSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Custom review field")
      .setDesc("Campo de frontmatter usado como data de revisão, por exemplo: reviewed_at")
      .addText((text) =>
        text
          .setPlaceholder("reviewed_at")
          .setValue(this.plugin.settings.customReviewField)
          .onChange(async (value) => {
            this.plugin.settings.customReviewField = value.trim() || "reviewed_at";
            await this.plugin.savePluginSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Batch size")
      .setDesc("Quantidade de notas processadas por lote.")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.batchSize))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (Number.isFinite(parsed) && parsed > 0) {
              this.plugin.settings.batchSize = parsed;
              await this.plugin.savePluginSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Large note threshold")
      .setDesc("Quantidade mínima de palavras para classificar nota como grande.")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.largeNoteWordThreshold))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (Number.isFinite(parsed) && parsed > 0) {
              this.plugin.settings.largeNoteWordThreshold = parsed;
              await this.plugin.savePluginSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Note type policies (JSON)")
      .setDesc("Edite as políticas por tipo de nota em JSON.")
      .addTextArea((text) =>
        text
          .setPlaceholder("[]")
          .setValue(JSON.stringify(this.plugin.settings.noteTypePolicies, null, 2))
          .onChange(async (value) => {
            try {
              const parsed = JSON.parse(value);
              if (!Array.isArray(parsed)) {
                throw new Error("O valor precisa ser um array JSON.");
              }

              this.plugin.settings.noteTypePolicies = parsed;
              await this.plugin.savePluginSettings();
            } catch (error) {
              new Notice(`JSON inválido em noteTypePolicies: ${String(error)}`);
            }
          }),
      );
  }
}
'@

Write-Utf8File "src/ui/stores/dashboardStore.ts" @'
import type { VaultAuditResult } from "../../types/audit";

export interface DashboardState {
  loading: boolean;
  result: VaultAuditResult | null;
}

export function createDashboardState(): DashboardState {
  return {
    loading: false,
    result: null,
  };
}
'@

Write-Utf8File "src/ui/stores/settingsStore.ts" @'
import type { VaultHealthSettings } from "../../types/settings";
import { DEFAULT_SETTINGS } from "../../constants";

export function createSettingsState(): VaultHealthSettings {
  return { ...DEFAULT_SETTINGS };
}
'@

Write-Utf8File "src/ui/components/DashboardApp.svelte" @'
<script lang="ts">
  export let title = "Vault Health Auditor";
</script>

<div class="vha-svelte-placeholder">
  <h2>{title}</h2>
  <p>Placeholder Svelte component para evolução futura do dashboard.</p>
</div>
'@

Write-Utf8File "src/ui/components/ScoreCard.svelte" @'
<script lang="ts">
  export let title = "Score";
  export let value = "0";
</script>

<div class="vha-svelte-placeholder">
  <small>{title}</small>
  <h3>{value}</h3>
</div>
'@

Write-Utf8File "src/ui/components/IssueTable.svelte" @'
<script lang="ts">
  export let issues: string[] = [];
</script>

<div class="vha-svelte-placeholder">
  <h3>Issues</h3>
  {#if issues.length === 0}
    <p>Sem issues.</p>
  {:else}
    <ul>
      {#each issues as issue}
        <li>{issue}</li>
      {/each}
    </ul>
  {/if}
</div>
'@

Write-Utf8File "src/ui/components/TrendChart.svelte" @'
<script lang="ts">
  export let points: number[] = [];
</script>

<div class="vha-svelte-placeholder">
  <h3>Trend</h3>
  <p>Pontos carregados: {points.length}</p>
</div>
'@

Write-Utf8File "src/ui/components/FiltersPanel.svelte" @'
<script lang="ts">
  export let label = "Filters";
</script>

<div class="vha-svelte-placeholder">
  <h3>{label}</h3>
  <p>Placeholder para filtros avançados.</p>
</div>
'@

Write-Utf8File "src/commands/openDashboard.ts" @'
import type VaultHealthAuditorPlugin from "../main";

export async function openDashboard(plugin: VaultHealthAuditorPlugin): Promise<void> {
  await plugin.ensureDashboardOpen();
}
'@

Write-Utf8File "src/commands/runFullAudit.ts" @'
import type VaultHealthAuditorPlugin from "../main";

export async function runFullAuditCommand(plugin: VaultHealthAuditorPlugin): Promise<void> {
  await plugin.runFullAudit();
}
'@

Write-Utf8File "src/commands/runIncrementalAudit.ts" @'
import type VaultHealthAuditorPlugin from "../main";

export async function runIncrementalAuditCommand(
  plugin: VaultHealthAuditorPlugin,
): Promise<void> {
  await plugin.runIncrementalAudit();
}
'@

Write-Utf8File "src/main.ts" @'
import { Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import {
  DEFAULT_SETTINGS,
  PLUGIN_NAME,
  VIEW_TYPE_DASHBOARD,
} from "./constants";
import type { VaultHealthSettings } from "./types/settings";
import { AuditRepository } from "./core/AuditRepository";
import { SnapshotBuilder } from "./core/SnapshotBuilder";
import { RuleRegistry } from "./core/RuleRegistry";
import { HealthScoreService } from "./scoring/HealthScoreService";
import { Scheduler } from "./core/Scheduler";
import { AuditEngine } from "./core/AuditEngine";
import { DashboardView } from "./ui/views/DashboardView";
import { VaultHealthSettingTab } from "./ui/settings/VaultHealthSettingTab";
import { IncrementalIndexer } from "./core/IncrementalIndexer";
import { openDashboard } from "./commands/openDashboard";
import { runFullAuditCommand } from "./commands/runFullAudit";
import { runIncrementalAuditCommand } from "./commands/runIncrementalAudit";
import { logger } from "./utils/logger";

export default class VaultHealthAuditorPlugin extends Plugin {
  settings: VaultHealthSettings = DEFAULT_SETTINGS;
  repository!: AuditRepository;
  progress = { scanned: 0, total: 0 };

  private readonly indexer = new IncrementalIndexer();
  private engine!: AuditEngine;
  private running = false;

  async onload(): Promise<void> {
    logger.info("Loading plugin");

    this.repository = new AuditRepository(this);
    this.settings = await this.repository.getSettings(DEFAULT_SETTINGS);
    this.engine = this.createEngine();

    this.registerView(
      VIEW_TYPE_DASHBOARD,
      (leaf) => new DashboardView(leaf, this),
    );

    this.addSettingTab(new VaultHealthSettingTab(this.app, this));

    this.addCommand({
      id: "open-dashboard",
      name: "Open audit dashboard",
      callback: () => openDashboard(this),
    });

    this.addCommand({
      id: "run-full-audit",
      name: "Run full audit",
      callback: () => runFullAuditCommand(this),
    });

    this.addCommand({
      id: "run-incremental-audit",
      name: "Run incremental audit",
      callback: () => runIncrementalAuditCommand(this),
    });

    this.registerVaultEvents();

    this.app.workspace.onLayoutReady(async () => {
      if (this.settings.fullAuditOnStartup) {
        await this.runFullAudit();
      }
    });
  }

  onunload(): void {
    logger.info("Unloading plugin");
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_DASHBOARD);
  }

  async savePluginSettings(): Promise<void> {
    await this.repository.saveSettings(this.settings);
    this.engine = this.createEngine();
    await this.refreshDashboardViews();
  }

  async ensureDashboardOpen(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
    let leaf: WorkspaceLeaf | null = leaves[0] ?? null;

    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({
        type: VIEW_TYPE_DASHBOARD,
        active: true,
      });
    }

    this.app.workspace.revealLeaf(leaf);
  }

  async runFullAudit(): Promise<void> {
    if (this.running) {
      new Notice("Uma auditoria já está em execução.");
      return;
    }

    try {
      this.running = true;
      this.progress = { scanned: 0, total: 0 };
      new Notice("Executando full audit...");

      const result = await this.engine.runFullAudit();
      await this.refreshDashboardViews();

      new Notice(
        `Auditoria concluída. Score: ${result.breakdown.total}. Issues: ${result.issues.length}.`,
      );
    } catch (error) {
      logger.error(error);
      new Notice(`Erro durante full audit: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }

  async runIncrementalAudit(): Promise<void> {
    if (this.running) {
      new Notice("Uma auditoria já está em execução.");
      return;
    }

    const dirty = this.indexer.consumeDirty();
    if (dirty.length === 0) {
      new Notice("Nenhuma nota modificada desde a última verificação incremental.");
      return;
    }

    try {
      this.running = true;
      this.progress = { scanned: 0, total: dirty.length };
      new Notice(`Executando incremental audit em ${dirty.length} nota(s)...`);

      const result = await this.engine.runIncrementalAudit(dirty);
      await this.refreshDashboardViews();

      new Notice(
        `Incremental audit concluído. Score atual: ${result.breakdown.total}.`,
      );
    } catch (error) {
      logger.error(error);
      new Notice(`Erro durante incremental audit: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }

  private createEngine(): AuditEngine {
    return new AuditEngine(
      this.app,
      new SnapshotBuilder(this.app, () => this.settings),
      new RuleRegistry(),
      new HealthScoreService(),
      this.repository,
      new Scheduler(),
      () => this.settings,
      (progress) => {
        this.progress = progress;
        void this.refreshDashboardViews();
      },
    );
  }

  private registerVaultEvents(): void {
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.indexer.markDirty(file.path);
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.indexer.markDirty(file.path);
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile && file.extension === "md") {
          this.indexer.markDirty(file.path);
          this.indexer.markDeleted(oldPath);
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.indexer.markDeleted(file.path);
        }
      }),
    );
  }

  private async refreshDashboardViews(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
    await Promise.all(
      leaves.map(async (leaf) => {
        const view = leaf.view;
        if (view instanceof DashboardView) {
          await view.render();
        }
      }),
    );
  }
}
'@

Write-Utf8File "tests/mocks/obsidian.ts" @'
import { vi } from "vitest";

export class TFile {
  constructor(
    public path: string,
    public basename: string,
    public stat: { mtime: number; ctime: number; size: number },
    public extension = "md",
  ) {}
}

export class Plugin {
  async loadData() {
    return {};
  }

  async saveData(_data: unknown) {
    return;
  }
}

export const mockVault = {
  getMarkdownFiles: vi.fn(),
  cachedRead: vi.fn(),
  on: vi.fn((_event, callback) => callback),
};

export const mockMetadataCache = {
  getFileCache: vi.fn(),
  getFirstLinkpathDest: vi.fn(),
  unresolvedLinks: {},
};

export const mockWorkspace = {
  getLeavesOfType: vi.fn(() => []),
  getRightLeaf: vi.fn(),
  revealLeaf: vi.fn(),
  detachLeavesOfType: vi.fn(),
  onLayoutReady: vi.fn((cb) => cb()),
};

export const mockApp = {
  vault: mockVault,
  metadataCache: mockMetadataCache,
  workspace: mockWorkspace,
};
'@

Write-Utf8File "tests/unit/HealthScoreService.test.ts" @'
import { describe, expect, it } from "vitest";
import { HealthScoreService } from "../../src/scoring/HealthScoreService";

describe("HealthScoreService", () => {
  it("should reduce score when issues exist", () => {
    const service = new HealthScoreService();

    const breakdown = service.calculate(
      [
        {
          ruleId: "broken-links",
          severity: "error",
          category: "links",
          filePath: "note.md",
          title: "Broken links",
          message: "Found 2 broken links",
          scoreImpact: 4,
        },
      ],
      10,
    );

    expect(breakdown.total).toBeLessThan(100);
    expect(breakdown.issueCountBySeverity.error).toBe(1);
  });
});
'@

Write-Utf8File "tests/unit/MarkdownStructureAnalyzer.test.ts" @'
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
'@

Write-Utf8File "tests/unit/FrontmatterPolicyMatcher.test.ts" @'
import { describe, expect, it } from "vitest";
import { FrontmatterPolicyMatcher } from "../../src/analyzers/FrontmatterPolicyMatcher";

describe("FrontmatterPolicyMatcher", () => {
  it("should return missing fields for note type", () => {
    const matcher = new FrontmatterPolicyMatcher([
      {
        noteType: "book",
        requiredFrontmatter: ["author", "year"],
        summaryRequired: true,
        staleAfterDays: 90,
      },
    ]);

    const missing = matcher.missingFields({ year: 2020 }, "book");
    expect(missing).toEqual(["author"]);
  });
});
'@

Write-Utf8File "tests/unit/AuditEngine.test.ts" @'
import { describe, expect, it, vi } from "vitest";
import { AuditEngine } from "../../src/core/AuditEngine";
import { HealthScoreService } from "../../src/scoring/HealthScoreService";

describe("AuditEngine", () => {
  it("should run and return a result", async () => {
    const files = [
      {
        path: "note.md",
        basename: "note",
        stat: { mtime: Date.now(), ctime: Date.now(), size: 100 },
      },
    ];

    const app = {
      vault: {
        getMarkdownFiles: () => files,
      },
      metadataCache: {
        getFileCache: () => ({ links: [] }),
        getFirstLinkpathDest: () => null,
      },
    };

    const snapshotBuilder = {
      build: vi.fn(async () => ({
        path: "note.md",
        basename: "note",
        mtime: Date.now() - 1000 * 60 * 60 * 24 * 100,
        ctime: Date.now(),
        sizeBytes: 100,
        links: [],
        unresolvedLinks: [],
        inlinksCount: 0,
        outlinksCount: 0,
        headings: [],
        tags: [],
        frontmatter: {},
        hasSummary: false,
        paragraphCount: 1,
        wordCount: 10,
        lineCount: 2,
        rawContent: "Some content.",
      })),
    };

    const ruleRegistry = {
      getRules: () => [
        {
          id: "note-age",
          name: "Age",
          description: "Age rule",
          run: () => [
            {
              ruleId: "note-age",
              severity: "warning",
              category: "freshness",
              filePath: "note.md",
              title: "Old note",
              message: "Too old",
              scoreImpact: 2,
            },
          ],
        },
      ],
    };

    const repository = {
      saveResult: vi.fn(async () => undefined),
      getLastResult: vi.fn(async () => null),
    };

    const scheduler = {
      yield: vi.fn(async () => undefined),
    };

    const engine = new AuditEngine(
      app as never,
      snapshotBuilder as never,
      ruleRegistry as never,
      new HealthScoreService(),
      repository as never,
      scheduler as never,
      () => ({
        enabledRules: ["note-age"],
        noteTypePolicies: [],
        ignoredFolders: [],
        ignoredTags: [],
        largeNoteWordThreshold: 1000,
        dumpPageLinkThreshold: 30,
        dumpPageParagraphDensityMin: 0.2,
        fullAuditOnStartup: false,
        maxConcurrentReads: 4,
        batchSize: 10,
        customReviewField: "reviewed_at",
      }),
    );

    const result = await engine.runFullAudit();

    expect(result.filesScanned).toBe(1);
    expect(result.issues.length).toBe(1);
    expect(repository.saveResult).toHaveBeenCalledOnce();
  });
});
'@

Write-Utf8File "manifest.json" @'
{
  "id": "vault-health-auditor",
  "name": "Vault Health Auditor",
  "version": "0.1.0",
  "minAppVersion": "1.5.0",
  "description": "Audit note freshness, structure, metadata and knowledge debt inside your vault.",
  "author": "Rafael Pulzi",
  "authorUrl": "https://github.com/RafaelPulzi",
  "isDesktopOnly": false
}
'@

Write-Utf8File "versions.json" @'
{
  "0.1.0": "1.5.0"
}
'@

Write-Utf8File "package.json" @'
{
  "name": "vault-health-auditor",
  "version": "0.1.0",
  "private": true,
  "description": "Obsidian plugin for vault maintenance, PKM quality and knowledge debt auditing.",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "node esbuild.config.mjs production",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "esbuild": "^0.25.0",
    "obsidian": "latest",
    "tslib": "^2.8.1",
    "typescript": "^5.8.2",
    "vitest": "^3.1.1"
  }
}
'@

Write-Utf8File "tsconfig.json" @'
{
  "compilerOptions": {
    "baseUrl": ".",
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["DOM", "ES2020"],
    "strict": true,
    "allowJs": false,
    "noEmit": true,
    "types": ["node"],
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
'@

Write-Utf8File "esbuild.config.mjs" @'
import esbuild from "esbuild";
import process from "node:process";

const production = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron"],
  format: "cjs",
  target: "es2018",
  outfile: "main.js",
  sourcemap: production ? false : "inline",
  minify: production,
  logLevel: "info",
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
  console.log("Watching for changes...");
}
'@

Write-Utf8File "styles.css" @'
.vha-dashboard {
  padding: 1rem;
}

.vha-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.vha-actions {
  display: flex;
  gap: 0.5rem;
}

.vha-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.vha-card,
.vha-block,
.vha-issue,
.vha-svelte-placeholder {
  border: 1px solid var(--background-modifier-border);
  border-radius: 12px;
  padding: 0.75rem;
  background: var(--background-secondary);
}

.vha-block {
  margin-bottom: 1rem;
}

.vha-issues {
  display: grid;
  gap: 0.75rem;
}

.vha-info {
  border-left: 4px solid var(--interactive-accent);
}

.vha-warning {
  border-left: 4px solid var(--text-warning);
}

.vha-error,
.vha-critical {
  border-left: 4px solid var(--text-error);
}
'@

$readme = @(
'# Vault Health Auditor',
'',
'Plugin para Obsidian focado em manutenção ativa do vault, qualidade estrutural das notas e redução de dívida de conhecimento.',
'',
'## Funcionalidades do MVP',
'',
'- Auditoria completa e incremental',
'- Dashboard com score de saúde',
'- Detecção de:',
'  - notas sem revisão recente',
'  - links quebrados',
'  - notas órfãs',
'  - frontmatter obrigatório ausente',
'  - notas grandes sem headings',
'  - páginas com perfil de depósito',
'  - resumo ausente',
'  - claims potencialmente sem suporte',
'',
'## Scripts',
'',
'```bash',
'npm i',
'npm run dev',
'npm run build',
'npm run test:run',
'npm run lint',
'```',
'',
'## Estrutura',
'',
'O projeto está organizado por camadas:',
'- `core`: engine, scheduler, snapshots, persistência',
'- `rules`: regras de auditoria',
'- `analyzers`: heurísticas e parsing',
'- `ui`: dashboard e settings',
'- `tests`: unit tests',
'',
'## Próximos passos sugeridos',
'',
'- Evoluir a heurística de link fraco',
'- Adicionar autofix para frontmatter',
'- Trocar o dashboard DOM por Svelte real',
'- Adicionar filtros avançados e gráficos',
'- Persistir baseline e tendências por pasta/tipo'
) -join "`r`n"

Write-Utf8File "README.md" $readme

Write-Utf8File "LICENSE" @'
MIT License

Copyright (c) 2026 Rafael Pulzi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
'@

Write-Utf8File ".github/workflows/ci.yml" @'
name: CI

on:
  pull_request:
  push:
    branches: [main, master]

jobs:
  test-build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install
        run: npm ci

      - name: Typecheck
        run: npm run lint

      - name: Tests
        run: npm run test:run

      - name: Build
        run: npm run build
'@

Write-Utf8File ".github/workflows/release.yml" @'
name: Release plugin

on:
  push:
    tags:
      - "*.*.*"

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install
        run: npm ci

      - name: Typecheck
        run: npm run lint

      - name: Tests
        run: npm run test:run

      - name: Build
        run: npm run build

      - name: Validate manifest version
        shell: bash
        run: |
          TAG="${GITHUB_REF_NAME}"
          MANIFEST_VERSION=$(node -p "require('./manifest.json').version")
          if [ "$TAG" != "$MANIFEST_VERSION" ]; then
            echo "Tag ($TAG) does not match manifest version ($MANIFEST_VERSION)"
            exit 1
          fi

      - name: Create GitHub release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.ref_name }}
          name: ${{ github.ref_name }}
          files: |
            main.js
            manifest.json
            styles.css
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
'@

Write-Host "Conteúdo inicial do vault-health-auditor gerado com sucesso!" -ForegroundColor Green