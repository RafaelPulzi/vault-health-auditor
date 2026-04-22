import type { AuditIssue, AuditRule, AuditRuleContext } from "../types/audit";
import type { NoteSnapshot } from "../types/snapshot";
import { FrontmatterPolicyMatcher } from "../analyzers/FrontmatterPolicyMatcher";

export class MissingSummaryRule implements AuditRule {
  readonly id = "missing-summary" as const;
  readonly name = "Missing summary";
  readonly description = "Checks if notes that require summary actually have one.";
  readonly requiresContent = true;

  run(snapshot: NoteSnapshot, ctx: AuditRuleContext): AuditIssue[] {
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