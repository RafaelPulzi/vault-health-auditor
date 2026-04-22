import type { AuditIssue, AuditRule } from "../types/audit";
import type { NoteSnapshot } from "../types/snapshot";
import { LinkStrengthAnalyzer } from "../analyzers/LinkStrengthAnalyzer";

export class BrokenLinksRule implements AuditRule {
  readonly id = "broken-links" as const;
  readonly name = "Broken or weak links";
  readonly description = "Detects unresolved links and weak link context.";

  run(snapshot: NoteSnapshot): AuditIssue[] {
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