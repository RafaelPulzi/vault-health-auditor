import type { AuditIssue, AuditRule, AuditRuleContext } from "../types/audit";
import type { NoteSnapshot } from "../types/snapshot";
import { FrontmatterPolicyMatcher } from "../analyzers/FrontmatterPolicyMatcher";

export class RequiredFrontmatterRule implements AuditRule {
  readonly id = "required-frontmatter" as const;
  readonly name = "Required frontmatter";
  readonly description = "Checks mandatory frontmatter based on note type.";

  run(snapshot: NoteSnapshot, ctx: AuditRuleContext): AuditIssue[] {
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