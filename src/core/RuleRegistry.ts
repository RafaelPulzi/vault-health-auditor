import type { AuditRule } from "../types/audit";
import type { VaultHealthSettings } from "../types/settings";
import { NoteAgeRule } from "../rules/NoteAgeRule";
import { BrokenLinksRule } from "../rules/BrokenLinksRule";
import { OrphanNoteRule } from "../rules/OrphanNoteRule";
import { RequiredFrontmatterRule } from "../rules/RequiredFrontmatterRule";
import { LargeUnstructuredNoteRule } from "../rules/LargeUnstructuredNoteRule";
import { DumpPageRule } from "../rules/DumpPageRule";
import { MissingSummaryRule } from "../rules/MissingSummaryRule";
import { UnsupportedClaimsRule } from "../rules/UnsupportedClaimsRule";

export class RuleRegistry {
  private readonly rules: AuditRule[] = [
    new NoteAgeRule(),
    new BrokenLinksRule(),
    new OrphanNoteRule(),
    new RequiredFrontmatterRule(),
    new LargeUnstructuredNoteRule(),
    new DumpPageRule(),
    new MissingSummaryRule(),
    new UnsupportedClaimsRule(),
  ];

  getRules(settings: VaultHealthSettings): AuditRule[] {
    return this.rules.filter((rule) => settings.enabledRules.includes(rule.id));
  }
}
