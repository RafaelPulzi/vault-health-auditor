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
