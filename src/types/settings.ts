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
