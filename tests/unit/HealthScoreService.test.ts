import { describe, expect, it } from "vitest";
import { HealthScoreService } from "../../src/scoring/HealthScoreService";

describe("HealthScoreService", () => {
  it("should reduce score when issues exist", () => {
    const service = new HealthScoreService();

    const breakdown = service.calculate(
      [
        {
          ruleId: "broken-links",
          severity: "error",
          category: "links",
          filePath: "note.md",
          title: "Broken links",
          message: "Found 2 broken links",
          scoreImpact: 4,
        },
      ],
      10,
    );

    expect(breakdown.total).toBeLessThan(100);
    expect(breakdown.issueCountBySeverity.error).toBe(1);
  });
});
