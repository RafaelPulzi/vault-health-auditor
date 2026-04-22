import type { AuditIssue, AuditRule } from "../types/audit";
import type { NoteSnapshot } from "../types/snapshot";
import { ClaimDetector } from "../analyzers/ClaimDetector";

export class UnsupportedClaimsRule implements AuditRule {
  readonly id = "unsupported-claims" as const;
  readonly name = "Unsupported claims";
  readonly description = "Flags assertive claims without nearby references.";
  readonly requiresContent = true;

  run(snapshot: NoteSnapshot): AuditIssue[] {
    if (!snapshot.rawContent) {
      return [];
    }

    const report = new ClaimDetector().analyze(snapshot.rawContent);
    if (report.unsupportedClaimCount === 0) {
      return [];
    }

    return [
      {
        ruleId: this.id,
        severity: "warning",
        category: "knowledge-quality",
        filePath: snapshot.path,
        title: "Claims sem suporte detectados",
        message: `Foram encontradas ${report.unsupportedClaimCount} afirmações potencialmente sem fonte.`,
        evidence: report.samples,
        scoreImpact: 3,
      },
    ];
  }
}