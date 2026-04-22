import type { AuditIssue, AuditRule, AuditRuleContext } from "../types/audit";
import type { NoteSnapshot } from "../types/snapshot";

export class DumpPageRule implements AuditRule {
  readonly id = "dump-page" as const;
  readonly name = "Dump page";
  readonly description = "Detects notes that look like unstructured dumping grounds.";
  readonly requiresContent = true;

  run(snapshot: NoteSnapshot, ctx: AuditRuleContext): AuditIssue[] {
    if (!snapshot.rawContent) {
      return [];
    }

    const tooManyLinks = snapshot.links.length >= ctx.settings.dumpPageLinkThreshold;
    const weakParagraphDensity =
      snapshot.wordCount > 0
        ? snapshot.paragraphCount / snapshot.wordCount < ctx.settings.dumpPageParagraphDensityMin
        : false;

    if (!tooManyLinks && !weakParagraphDensity) {
      return [];
    }

    return [
      {
        ruleId: this.id,
        severity: "warning",
        category: "structure",
        filePath: snapshot.path,
        title: "Página com característica de depósito",
        message: `A nota tem ${snapshot.links.length} links e ${snapshot.paragraphCount} parágrafo(s), sugerindo acúmulo sem curadoria.`,
        scoreImpact: 3,
      },
    ];
  }
}