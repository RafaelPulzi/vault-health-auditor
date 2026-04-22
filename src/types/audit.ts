import type { NoteSnapshot } from "./snapshot";
import type { VaultHealthSettings } from "./settings";
import type { HealthCategory, HealthScoreBreakdown } from "./score";

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
