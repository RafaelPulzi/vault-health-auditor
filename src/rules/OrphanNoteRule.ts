import type { AuditIssue, AuditRule } from "../types/audit";
import type { NoteSnapshot } from "../types/snapshot";

export class OrphanNoteRule implements AuditRule {
  readonly id = "orphan-note" as const;
  readonly name = "Orphan note";
  readonly description = "Detects notes without inlinks and outlinks.";

  run(snapshot: NoteSnapshot): AuditIssue[] {
    if (snapshot.inlinksCount > 0 || snapshot.outlinksCount > 0) {
      return [];
    }

    return [
      {
        ruleId: this.id,
        severity: "warning",
        category: "links",
        filePath: snapshot.path,
        title: "Nota órfã",
        message: "A nota não possui inlinks nem outlinks.",
        scoreImpact: 2,
      },
    ];
  }
}