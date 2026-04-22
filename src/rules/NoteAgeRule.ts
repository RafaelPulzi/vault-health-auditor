import type { AuditIssue, AuditRule, AuditRuleContext } from "../types/audit";
import type { NoteSnapshot } from "../types/snapshot";
import { FrontmatterPolicyMatcher } from "../analyzers/FrontmatterPolicyMatcher";
import { diffDays } from "../utils/time";

export class NoteAgeRule implements AuditRule {
  readonly id = "note-age" as const;
  readonly name = "Stale note";
  readonly description = "Detects notes that have not been reviewed recently.";

  run(snapshot: NoteSnapshot, ctx: AuditRuleContext): AuditIssue[] {
    const matcher = new FrontmatterPolicyMatcher(ctx.settings.noteTypePolicies);
    const policy = matcher.resolvePolicy(snapshot.noteType);
    const staleAfterDays = policy?.staleAfterDays ?? 45;

    const referenceTimestamp = snapshot.customReviewDate ?? snapshot.mtime;
    const ageDays = diffDays(referenceTimestamp, ctx.now);

    if (ageDays <= staleAfterDays) {
      return [];
    }

    const severity = ageDays > staleAfterDays * 2 ? "error" : "warning";

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