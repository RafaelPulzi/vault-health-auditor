import type { AuditIssue, AuditRule, AuditRuleContext } from "../types/audit";
import type { NoteSnapshot } from "../types/snapshot";

export class LargeUnstructuredNoteRule implements AuditRule {
  readonly id = "large-unstructured-note" as const;
  readonly name = "Large unstructured note";
  readonly description = "Detects long notes with poor heading structure.";
  readonly requiresContent = true;

  run(snapshot: NoteSnapshot, ctx: AuditRuleContext): AuditIssue[] {
    if (!snapshot.rawContent) {
      return [];
    }

    if (snapshot.wordCount < ctx.settings.largeNoteWordThreshold) {
      return [];
    }

    if (snapshot.headings.length >= 2) {
      return [];
    }

    return [
      {
        ruleId: this.id,
        severity: "warning",
        category: "structure",
        filePath: snapshot.path,
        title: "Nota grande sem estrutura suficiente",
        message: `A nota possui ${snapshot.wordCount} palavras e apenas ${snapshot.headings.length} heading(s).`,
        scoreImpact: 3,
      },
    ];
  }
}