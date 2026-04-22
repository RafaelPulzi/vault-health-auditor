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
  dumpPageParagraphDensityMin: 0.015,
  fullAuditOnStartup: false,
  maxConcurrentReads: 4,
  batchSize: 75,
  customReviewField: "reviewed_at",
};
