import { describe, expect, it } from "vitest";
import { FrontmatterPolicyMatcher } from "../../src/analyzers/FrontmatterPolicyMatcher";

describe("FrontmatterPolicyMatcher", () => {
  it("should return missing fields for note type", () => {
    const matcher = new FrontmatterPolicyMatcher([
      {
        noteType: "book",
        requiredFrontmatter: ["author", "year"],
        summaryRequired: true,
        staleAfterDays: 90,
      },
    ]);

    const missing = matcher.missingFields({ year: 2020 }, "book");
    expect(missing).toEqual(["author"]);
  });
});
