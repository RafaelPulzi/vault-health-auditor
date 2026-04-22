import type { NoteTypePolicy } from "../types/settings";

export class FrontmatterPolicyMatcher {
  constructor(private readonly policies: NoteTypePolicy[]) {}

  resolvePolicy(noteType?: string): NoteTypePolicy | undefined {
    if (!noteType) {
      return undefined;
    }

    return this.policies.find(
      (policy) => policy.noteType.toLowerCase() === noteType.toLowerCase(),
    );
  }

  missingFields(frontmatter: Record<string, unknown>, noteType?: string): string[] {
    const policy = this.resolvePolicy(noteType);
    if (!policy) {
      return [];
    }

    return policy.requiredFrontmatter.filter((field) => {
      const value = frontmatter[field];
      if (value == null) {
        return true;
      }

      if (typeof value === "string") {
        return value.trim().length === 0;
      }

      if (Array.isArray(value)) {
        return value.length === 0;
      }

      return false;
    });
  }
}
