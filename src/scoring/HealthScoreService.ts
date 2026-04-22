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
    const penaltiesByCategory: Record<HealthCategory, number> = {
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
      const weightedPenalty =
        issue.scoreImpact *
        RULE_WEIGHTS[issue.ruleId] *
        SEVERITY_MULTIPLIER[issue.severity];

      penaltiesByCategory[issue.category] += weightedPenalty;
      issueCountBySeverity[issue.severity] += 1;
      totalPenalty += weightedPenalty;
    }

    const normalizedPenalty = filesScanned > 0 ? (totalPenalty / filesScanned) * 5 : totalPenalty;
    const total = Math.max(0, Math.min(100, Math.round(100 - normalizedPenalty)));

    const byCategory = Object.fromEntries(
      CATEGORIES.map((category) => {
        const categoryPenalty = filesScanned > 0 ? (penaltiesByCategory[category] / filesScanned) * 8 : 0;
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
