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
