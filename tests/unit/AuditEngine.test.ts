import { describe, expect, it, vi } from "vitest";
import { AuditEngine } from "../../src/core/AuditEngine";
import { HealthScoreService } from "../../src/scoring/HealthScoreService";

describe("AuditEngine", () => {
  it("should run and return a result", async () => {
    const files = [
      {
        path: "note.md",
        basename: "note",
        stat: { mtime: Date.now(), ctime: Date.now(), size: 100 },
      },
    ];

    const app = {
      vault: {
        getMarkdownFiles: () => files,
      },
      metadataCache: {
        getFileCache: () => ({ links: [] }),
        getFirstLinkpathDest: () => null,
      },
    };

    const snapshotBuilder = {
      build: vi.fn(async () => ({
        path: "note.md",
        basename: "note",
        mtime: Date.now() - 1000 * 60 * 60 * 24 * 100,
        ctime: Date.now(),
        sizeBytes: 100,
        links: [],
        unresolvedLinks: [],
        inlinksCount: 0,
        outlinksCount: 0,
        headings: [],
        tags: [],
        frontmatter: {},
        hasSummary: false,
        paragraphCount: 1,
        wordCount: 10,
        lineCount: 2,
        rawContent: "Some content.",
      })),
    };

    const ruleRegistry = {
      getRules: () => [
        {
          id: "note-age",
          name: "Age",
          description: "Age rule",
          run: () => [
            {
              ruleId: "note-age",
              severity: "warning",
              category: "freshness",
              filePath: "note.md",
              title: "Old note",
              message: "Too old",
              scoreImpact: 2,
            },
          ],
        },
      ],
    };

    const repository = {
      saveResult: vi.fn(async () => undefined),
      getLastResult: vi.fn(async () => null),
    };

    const scheduler = {
      yield: vi.fn(async () => undefined),
    };

    const engine = new AuditEngine(
      app as never,
      snapshotBuilder as never,
      ruleRegistry as never,
      new HealthScoreService(),
      repository as never,
      scheduler as never,
      () => ({
        enabledRules: ["note-age"],
        noteTypePolicies: [],
        ignoredFolders: [],
        ignoredTags: [],
        largeNoteWordThreshold: 1000,
        dumpPageLinkThreshold: 30,
        dumpPageParagraphDensityMin: 0.02,
        fullAuditOnStartup: false,
        maxConcurrentReads: 4,
        batchSize: 10,
        customReviewField: "reviewed_at",
      }),
    );

    const result = await engine.runFullAudit();

    expect(result.filesScanned).toBe(1);
    expect(result.issues.length).toBe(1);
    expect(repository.saveResult).toHaveBeenCalledOnce();
  });
});
