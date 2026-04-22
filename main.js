"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => VaultHealthAuditorPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/constants.ts
var PLUGIN_NAME = "Vault Health Auditor";
var VIEW_TYPE_DASHBOARD = "vault-health-auditor-dashboard";
var DEFAULT_SETTINGS = {
  enabledRules: [
    "note-age",
    "broken-links",
    "orphan-note",
    "required-frontmatter",
    "large-unstructured-note",
    "dump-page",
    "missing-summary",
    "unsupported-claims"
  ],
  noteTypePolicies: [
    {
      noteType: "book",
      requiredFrontmatter: ["author", "year", "status"],
      summaryRequired: true,
      staleAfterDays: 90
    },
    {
      noteType: "article",
      requiredFrontmatter: ["author", "source", "published"],
      summaryRequired: true,
      staleAfterDays: 60
    },
    {
      noteType: "permanent",
      requiredFrontmatter: ["summary"],
      summaryRequired: true,
      staleAfterDays: 120
    },
    {
      noteType: "fleeting",
      requiredFrontmatter: [],
      summaryRequired: false,
      staleAfterDays: 14
    }
  ],
  ignoredFolders: [".obsidian", "Templates"],
  ignoredTags: ["no-audit"],
  largeNoteWordThreshold: 1200,
  dumpPageLinkThreshold: 35,
  dumpPageParagraphDensityMin: 0.015,
  fullAuditOnStartup: false,
  maxConcurrentReads: 4,
  batchSize: 75,
  customReviewField: "reviewed_at"
};

// src/persistence/dataMappers.ts
function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
function toHistoryEntry(result) {
  return {
    timestamp: result.finishedAt,
    total: result.breakdown.total,
    issueCount: result.issues.length,
    filesScanned: result.filesScanned
  };
}

// src/persistence/storageSchema.ts
var DEFAULT_STORAGE_DATA = {
  settings: DEFAULT_SETTINGS,
  audit: {
    lastResult: null,
    history: []
  }
};

// src/core/AuditRepository.ts
var AuditRepository = class {
  constructor(plugin) {
    this.plugin = plugin;
  }
  async read() {
    var _a, _b, _c, _d, _e;
    const raw = await this.plugin.loadData();
    return {
      settings: {
        ...DEFAULT_SETTINGS,
        ...(_a = raw == null ? void 0 : raw.settings) != null ? _a : {}
      },
      audit: {
        lastResult: (_c = (_b = raw == null ? void 0 : raw.audit) == null ? void 0 : _b.lastResult) != null ? _c : DEFAULT_STORAGE_DATA.audit.lastResult,
        history: (_e = (_d = raw == null ? void 0 : raw.audit) == null ? void 0 : _d.history) != null ? _e : DEFAULT_STORAGE_DATA.audit.history
      }
    };
  }
  async getSettings(fallback = DEFAULT_SETTINGS) {
    const data = await this.read();
    return {
      ...fallback,
      ...deepClone(data.settings)
    };
  }
  async saveSettings(settings) {
    const data = await this.read();
    data.settings = deepClone(settings);
    await this.plugin.saveData(data);
  }
  async getLastResult() {
    const data = await this.read();
    return data.audit.lastResult ? deepClone(data.audit.lastResult) : null;
  }
  async getHistory() {
    const data = await this.read();
    return deepClone(data.audit.history);
  }
  async saveResult(result) {
    const data = await this.read();
    data.audit.lastResult = deepClone(result);
    data.audit.history = [...data.audit.history, toHistoryEntry(result)].slice(-30);
    await this.plugin.saveData(data);
  }
};

// src/utils/markdown.ts
function stripFrontmatter(markdown) {
  if (!markdown.startsWith("---")) {
    return markdown;
  }
  const endIndex = markdown.indexOf("\n---", 3);
  if (endIndex === -1) {
    return markdown;
  }
  return markdown.slice(endIndex + 4).trimStart();
}
function getParagraphs(markdown) {
  return stripFrontmatter(markdown).split(/\n\s*\n/g).map((chunk) => chunk.trim()).filter((chunk) => chunk.length > 0);
}
function getWordCount(markdown) {
  return stripFrontmatter(markdown).replace(/\[\[.*?\]\]/g, " ").replace(/\[.*?\]\(.*?\)/g, " ").split(/\s+/).filter(Boolean).length;
}
function getLineCount(markdown) {
  return markdown.split(/\r?\n/).length;
}
function hasIntroSummary(markdown) {
  const paragraphs = getParagraphs(markdown);
  if (paragraphs.length === 0) {
    return false;
  }
  const firstParagraph = paragraphs.find((paragraph) => !paragraph.startsWith("#"));
  if (!firstParagraph) {
    return false;
  }
  if (/^summary\s*:/i.test(firstParagraph)) {
    return true;
  }
  return firstParagraph.length >= 80;
}

// src/analyzers/MarkdownStructureAnalyzer.ts
var MarkdownStructureAnalyzer = class {
  analyze(markdown) {
    const stripped = stripFrontmatter(markdown);
    const lines = stripped.split(/\r?\n/);
    const paragraphs = getParagraphs(markdown);
    const headingCount = lines.filter((line) => /^#{1,6}\s+/.test(line)).length;
    const wordCount = getWordCount(markdown);
    const lineCount = getLineCount(markdown);
    const paragraphCount = paragraphs.length;
    const paragraphDensity = wordCount > 0 ? paragraphCount / wordCount : 0;
    return {
      headingCount,
      paragraphCount,
      wordCount,
      lineCount,
      hasSummary: hasIntroSummary(markdown),
      paragraphDensity
    };
  }
};

// src/utils/time.ts
var DAY_MS = 1e3 * 60 * 60 * 24;
function parseDateLike(value) {
  if (value == null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}
function diffDays(fromTimestamp, toTimestamp) {
  return Math.floor((toTimestamp - fromTimestamp) / DAY_MS);
}

// src/core/SnapshotBuilder.ts
var SnapshotBuilder = class {
  constructor(app, settingsProvider) {
    this.app = app;
    this.settingsProvider = settingsProvider;
    this.structureAnalyzer = new MarkdownStructureAnalyzer();
  }
  async build(file, index, includeContent) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = (_a = cache == null ? void 0 : cache.frontmatter) != null ? _a : {};
    const reviewField = this.settingsProvider().customReviewField;
    const rawContent = includeContent ? await this.app.vault.cachedRead(file) : void 0;
    const structure = rawContent ? this.structureAnalyzer.analyze(rawContent) : {
      headingCount: (_c = (_b = cache == null ? void 0 : cache.headings) == null ? void 0 : _b.length) != null ? _c : 0,
      paragraphCount: 0,
      wordCount: 0,
      lineCount: 0,
      hasSummary: Boolean(frontmatter.summary),
      paragraphDensity: 0
    };
    const unresolvedMap = (_d = this.app.metadataCache.unresolvedLinks) != null ? _d : {};
    return {
      path: file.path,
      basename: file.basename,
      mtime: file.stat.mtime,
      ctime: file.stat.ctime,
      sizeBytes: file.stat.size,
      links: (_f = (_e = cache == null ? void 0 : cache.links) == null ? void 0 : _e.map((link) => link.link)) != null ? _f : [],
      unresolvedLinks: Object.keys((_g = unresolvedMap[file.path]) != null ? _g : {}),
      inlinksCount: (_h = index.inlinks[file.path]) != null ? _h : 0,
      outlinksCount: (_i = index.outlinks[file.path]) != null ? _i : 0,
      headings: (_k = (_j = cache == null ? void 0 : cache.headings) == null ? void 0 : _j.map((item) => ({
        level: item.level,
        text: item.heading
      }))) != null ? _k : [],
      tags: (_m = (_l = cache == null ? void 0 : cache.tags) == null ? void 0 : _l.map((tag) => tag.tag.replace(/^#/, ""))) != null ? _m : [],
      frontmatter,
      hasSummary: structure.hasSummary || Boolean(frontmatter.summary),
      paragraphCount: structure.paragraphCount,
      wordCount: structure.wordCount,
      lineCount: structure.lineCount,
      rawContent,
      noteType: typeof frontmatter.type === "string" ? frontmatter.type : typeof frontmatter.note_type === "string" ? frontmatter.note_type : void 0,
      customReviewDate: parseDateLike(frontmatter[reviewField])
    };
  }
};

// src/analyzers/FrontmatterPolicyMatcher.ts
var FrontmatterPolicyMatcher = class {
  constructor(policies) {
    this.policies = policies;
  }
  resolvePolicy(noteType) {
    if (!noteType) {
      return void 0;
    }
    return this.policies.find(
      (policy) => policy.noteType.toLowerCase() === noteType.toLowerCase()
    );
  }
  missingFields(frontmatter, noteType) {
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
};

// src/rules/NoteAgeRule.ts
var NoteAgeRule = class {
  constructor() {
    this.id = "note-age";
    this.name = "Stale note";
    this.description = "Detects notes that have not been reviewed recently.";
  }
  run(snapshot, ctx) {
    var _a, _b;
    const matcher = new FrontmatterPolicyMatcher(ctx.settings.noteTypePolicies);
    const policy = matcher.resolvePolicy(snapshot.noteType);
    const staleAfterDays = (_a = policy == null ? void 0 : policy.staleAfterDays) != null ? _a : 45;
    const referenceTimestamp = (_b = snapshot.customReviewDate) != null ? _b : snapshot.mtime;
    const ageDays = diffDays(referenceTimestamp, ctx.now);
    if (ageDays <= staleAfterDays) {
      return [];
    }
    const severity = ageDays > staleAfterDays * 2 ? "error" : "warning";
    return [
      {
        ruleId: this.id,
        severity,
        category: "freshness",
        filePath: snapshot.path,
        title: "Nota sem revis\xE3o recente",
        message: `A nota est\xE1 h\xE1 ${ageDays} dias sem revis\xE3o. Limite configurado: ${staleAfterDays} dias.`,
        scoreImpact: severity === "error" ? 3 : 2,
        metadata: {
          ageDays,
          staleAfterDays
        }
      }
    ];
  }
};

// src/analyzers/LinkStrengthAnalyzer.ts
var LinkStrengthAnalyzer = class {
  analyze(markdown) {
    const lines = markdown.split(/\r?\n/);
    const isolated = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return false;
      }
      const containsLink = /\[\[.*?\]\]/.test(trimmed) || /\[.*?\]\(.*?\)/.test(trimmed);
      if (!containsLink) {
        return false;
      }
      const withoutLinks = trimmed.replace(/\[\[.*?\]\]/g, "").replace(/\[.*?\]\(.*?\)/g, "").replace(/^[-*]\s*/, "").trim();
      return withoutLinks.length < 10;
    });
    return {
      weakLinkCount: isolated.length,
      isolatedLinkLines: isolated.slice(0, 5)
    };
  }
};

// src/rules/BrokenLinksRule.ts
var BrokenLinksRule = class {
  constructor() {
    this.id = "broken-links";
    this.name = "Broken or weak links";
    this.description = "Detects unresolved links and weak link context.";
  }
  run(snapshot) {
    const issues = [];
    if (snapshot.unresolvedLinks.length > 0) {
      issues.push({
        ruleId: this.id,
        severity: "error",
        category: "links",
        filePath: snapshot.path,
        title: "Links quebrados encontrados",
        message: `A nota possui ${snapshot.unresolvedLinks.length} link(s) sem resolu\xE7\xE3o.`,
        evidence: snapshot.unresolvedLinks.slice(0, 5),
        scoreImpact: 4
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
          scoreImpact: 2
        });
      }
    }
    return issues;
  }
};

// src/rules/OrphanNoteRule.ts
var OrphanNoteRule = class {
  constructor() {
    this.id = "orphan-note";
    this.name = "Orphan note";
    this.description = "Detects notes without inlinks and outlinks.";
  }
  run(snapshot) {
    if (snapshot.inlinksCount > 0 || snapshot.outlinksCount > 0) {
      return [];
    }
    return [
      {
        ruleId: this.id,
        severity: "warning",
        category: "links",
        filePath: snapshot.path,
        title: "Nota \xF3rf\xE3",
        message: "A nota n\xE3o possui inlinks nem outlinks.",
        scoreImpact: 2
      }
    ];
  }
};

// src/rules/RequiredFrontmatterRule.ts
var RequiredFrontmatterRule = class {
  constructor() {
    this.id = "required-frontmatter";
    this.name = "Required frontmatter";
    this.description = "Checks mandatory frontmatter based on note type.";
  }
  run(snapshot, ctx) {
    var _a;
    const matcher = new FrontmatterPolicyMatcher(ctx.settings.noteTypePolicies);
    const missing = matcher.missingFields(snapshot.frontmatter, snapshot.noteType);
    if (missing.length === 0) {
      return [];
    }
    return [
      {
        ruleId: this.id,
        severity: "warning",
        category: "metadata",
        filePath: snapshot.path,
        title: "Frontmatter obrigat\xF3rio ausente",
        message: `Campos ausentes para o tipo "${(_a = snapshot.noteType) != null ? _a : "desconhecido"}": ${missing.join(", ")}.`,
        evidence: missing,
        scoreImpact: 2,
        autofixable: false
      }
    ];
  }
};

// src/rules/LargeUnstructuredNoteRule.ts
var LargeUnstructuredNoteRule = class {
  constructor() {
    this.id = "large-unstructured-note";
    this.name = "Large unstructured note";
    this.description = "Detects long notes with poor heading structure.";
    this.requiresContent = true;
  }
  run(snapshot, ctx) {
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
        scoreImpact: 3
      }
    ];
  }
};

// src/rules/DumpPageRule.ts
var DumpPageRule = class {
  constructor() {
    this.id = "dump-page";
    this.name = "Dump page";
    this.description = "Detects notes that look like unstructured dumping grounds.";
    this.requiresContent = true;
  }
  run(snapshot, ctx) {
    if (!snapshot.rawContent) {
      return [];
    }
    const tooManyLinks = snapshot.links.length >= ctx.settings.dumpPageLinkThreshold;
    const weakParagraphDensity = snapshot.wordCount > 0 ? snapshot.paragraphCount / snapshot.wordCount < ctx.settings.dumpPageParagraphDensityMin : false;
    if (!tooManyLinks && !weakParagraphDensity) {
      return [];
    }
    return [
      {
        ruleId: this.id,
        severity: "warning",
        category: "structure",
        filePath: snapshot.path,
        title: "P\xE1gina com caracter\xEDstica de dep\xF3sito",
        message: `A nota tem ${snapshot.links.length} links e ${snapshot.paragraphCount} par\xE1grafo(s), sugerindo ac\xFAmulo sem curadoria.`,
        scoreImpact: 3
      }
    ];
  }
};

// src/rules/MissingSummaryRule.ts
var MissingSummaryRule = class {
  constructor() {
    this.id = "missing-summary";
    this.name = "Missing summary";
    this.description = "Checks if notes that require summary actually have one.";
    this.requiresContent = true;
  }
  run(snapshot, ctx) {
    const matcher = new FrontmatterPolicyMatcher(ctx.settings.noteTypePolicies);
    const policy = matcher.resolvePolicy(snapshot.noteType);
    if (!(policy == null ? void 0 : policy.summaryRequired)) {
      return [];
    }
    if (snapshot.hasSummary) {
      return [];
    }
    return [
      {
        ruleId: this.id,
        severity: "warning",
        category: "knowledge-quality",
        filePath: snapshot.path,
        title: "Resumo ausente",
        message: `Notas do tipo "${snapshot.noteType}" exigem resumo, mas nenhum foi detectado.`,
        scoreImpact: 2
      }
    ];
  }
};

// src/analyzers/ClaimDetector.ts
var ClaimDetector = class {
  analyze(markdown) {
    const normalized = markdown.replace(/\r?\n/g, " ");
    const sentences = normalized.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
    const unsupported = sentences.filter((sentence) => {
      if (sentence.length < 60) {
        return false;
      }
      const assertivePattern = /\b(Ã©|sÃ£o|deve|indica|demonstra|mostra|prova|shows|demonstrates|indicates|must|should)\b/i;
      const hasCitation = /\[\[.*?\]\]/.test(sentence) || /\[.*?\]\(.*?\)/.test(sentence) || /https?:\/\//i.test(sentence);
      return assertivePattern.test(sentence) && !hasCitation;
    });
    return {
      unsupportedClaimCount: unsupported.length,
      samples: unsupported.slice(0, 3)
    };
  }
};

// src/rules/UnsupportedClaimsRule.ts
var UnsupportedClaimsRule = class {
  constructor() {
    this.id = "unsupported-claims";
    this.name = "Unsupported claims";
    this.description = "Flags assertive claims without nearby references.";
    this.requiresContent = true;
  }
  run(snapshot) {
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
        message: `Foram encontradas ${report.unsupportedClaimCount} afirma\xE7\xF5es potencialmente sem fonte.`,
        evidence: report.samples,
        scoreImpact: 3
      }
    ];
  }
};

// src/core/RuleRegistry.ts
var RuleRegistry = class {
  constructor() {
    this.rules = [
      new NoteAgeRule(),
      new BrokenLinksRule(),
      new OrphanNoteRule(),
      new RequiredFrontmatterRule(),
      new LargeUnstructuredNoteRule(),
      new DumpPageRule(),
      new MissingSummaryRule(),
      new UnsupportedClaimsRule()
    ];
  }
  getRules(settings) {
    return this.rules.filter((rule) => settings.enabledRules.includes(rule.id));
  }
};

// src/scoring/ScoreWeights.ts
var RULE_WEIGHTS = {
  "note-age": 1.1,
  "broken-links": 2,
  "orphan-note": 1.4,
  "required-frontmatter": 1.2,
  "large-unstructured-note": 1.5,
  "dump-page": 1.8,
  "missing-summary": 1,
  "unsupported-claims": 2.2
};
var SEVERITY_MULTIPLIER = {
  info: 0.5,
  warning: 1,
  error: 1.75,
  critical: 2.5
};

// src/scoring/HealthScoreService.ts
var CATEGORIES = [
  "freshness",
  "links",
  "structure",
  "metadata",
  "knowledge-quality"
];
var HealthScoreService = class {
  calculate(issues, filesScanned) {
    const penaltiesByCategory = {
      freshness: 0,
      links: 0,
      structure: 0,
      metadata: 0,
      "knowledge-quality": 0
    };
    const issueCountBySeverity = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0
    };
    let totalPenalty = 0;
    for (const issue of issues) {
      const weightedPenalty = issue.scoreImpact * RULE_WEIGHTS[issue.ruleId] * SEVERITY_MULTIPLIER[issue.severity];
      penaltiesByCategory[issue.category] += weightedPenalty;
      issueCountBySeverity[issue.severity] += 1;
      totalPenalty += weightedPenalty;
    }
    const normalizedPenalty = filesScanned > 0 ? totalPenalty / filesScanned * 5 : totalPenalty;
    const total = Math.max(0, Math.min(100, Math.round(100 - normalizedPenalty)));
    const byCategory = Object.fromEntries(
      CATEGORIES.map((category) => {
        const categoryPenalty = filesScanned > 0 ? penaltiesByCategory[category] / filesScanned * 8 : 0;
        const score = Math.max(0, Math.min(100, Math.round(100 - categoryPenalty)));
        return [category, score];
      })
    );
    return {
      total,
      byCategory,
      penaltyPoints: Number(totalPenalty.toFixed(2)),
      issueCountBySeverity
    };
  }
};

// src/core/Scheduler.ts
var Scheduler = class {
  async yield() {
    await new Promise((resolve) => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => resolve());
        return;
      }
      setTimeout(() => resolve(), 0);
    });
  }
};

// src/utils/path.ts
function normalizePathLike(input) {
  return input.replace(/\\/g, "/").trim();
}
function isIgnoredPath(path, ignoredFolders) {
  const normalized = normalizePathLike(path).toLowerCase();
  return ignoredFolders.some((folder) => {
    const candidate = normalizePathLike(folder).toLowerCase();
    return normalized === candidate || normalized.startsWith(`${candidate}/`);
  });
}

// src/utils/batch.ts
function chunkArray(items, size) {
  if (size <= 0) {
    return [items];
  }
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

// src/core/AuditEngine.ts
var AuditEngine = class {
  constructor(app, snapshotBuilder, ruleRegistry, scoreService, repository, scheduler, settingsProvider, onProgress) {
    this.app = app;
    this.snapshotBuilder = snapshotBuilder;
    this.ruleRegistry = ruleRegistry;
    this.scoreService = scoreService;
    this.repository = repository;
    this.scheduler = scheduler;
    this.settingsProvider = settingsProvider;
    this.onProgress = onProgress;
  }
  async runFullAudit() {
    const settings = this.settingsProvider();
    const files = this.getEligibleFiles(settings);
    const index = this.buildIndex(files);
    const result = await this.run(files, index);
    await this.repository.saveResult(result);
    return result;
  }
  async runIncrementalAudit(paths) {
    var _a, _b, _c;
    const settings = this.settingsProvider();
    const eligibleFiles = this.getEligibleFiles(settings);
    const dirtySet = new Set(paths);
    const files = eligibleFiles.filter((file) => dirtySet.has(file.path));
    if (files.length === 0) {
      const lastResult = await this.repository.getLastResult();
      return lastResult != null ? lastResult : {
        startedAt: Date.now(),
        finishedAt: Date.now(),
        filesScanned: 0,
        issues: [],
        breakdown: this.scoreService.calculate([], 0),
        topOffenders: []
      };
    }
    const index = this.buildIndex(eligibleFiles);
    const partialResult = await this.run(files, index);
    const previous = await this.repository.getLastResult();
    const mergedIssues = this.mergeIssues((_a = previous == null ? void 0 : previous.issues) != null ? _a : [], partialResult.issues, files.map((file) => file.path));
    const mergedResult = {
      startedAt: partialResult.startedAt,
      finishedAt: partialResult.finishedAt,
      filesScanned: (_b = previous == null ? void 0 : previous.filesScanned) != null ? _b : eligibleFiles.length,
      issues: mergedIssues,
      breakdown: this.scoreService.calculate(mergedIssues, (_c = previous == null ? void 0 : previous.filesScanned) != null ? _c : eligibleFiles.length),
      topOffenders: this.computeTopOffenders(mergedIssues)
    };
    await this.repository.saveResult(mergedResult);
    return mergedResult;
  }
  getEligibleFiles(settings) {
    return this.app.vault.getMarkdownFiles().filter((file) => !isIgnoredPath(file.path, settings.ignoredFolders));
  }
  buildIndex(files) {
    var _a, _b, _c;
    const inlinks = {};
    const outlinks = {};
    const allPaths = /* @__PURE__ */ new Set();
    for (const file of files) {
      allPaths.add(file.path);
      const cache = this.app.metadataCache.getFileCache(file);
      const links = (_b = (_a = cache == null ? void 0 : cache.links) == null ? void 0 : _a.map((link) => link.link)) != null ? _b : [];
      outlinks[file.path] = links.length;
      for (const link of links) {
        const destination = this.app.metadataCache.getFirstLinkpathDest(link, file.path);
        if (destination) {
          inlinks[destination.path] = ((_c = inlinks[destination.path]) != null ? _c : 0) + 1;
        }
      }
    }
    return { allPaths, inlinks, outlinks };
  }
  async run(files, index) {
    var _a;
    const settings = this.settingsProvider();
    const startedAt = Date.now();
    const issues = [];
    const rules = this.ruleRegistry.getRules(settings);
    const metadataRules = rules.filter((rule) => !rule.requiresContent);
    const contentRules = rules.filter((rule) => rule.requiresContent);
    let scanned = 0;
    for (const batch of chunkArray(files, settings.batchSize)) {
      for (const file of batch) {
        const metadataSnapshot = await this.snapshotBuilder.build(file, index, false);
        if (this.hasIgnoredTag(metadataSnapshot.tags, settings.ignoredTags)) {
          scanned += 1;
          continue;
        }
        for (const rule of metadataRules) {
          const ruleIssues = await rule.run(metadataSnapshot, {
            now: Date.now(),
            settings,
            index
          });
          issues.push(...ruleIssues);
        }
        if (contentRules.length > 0) {
          const fullSnapshot = await this.snapshotBuilder.build(file, index, true);
          for (const rule of contentRules) {
            const ruleIssues = await rule.run(fullSnapshot, {
              now: Date.now(),
              settings,
              index
            });
            issues.push(...ruleIssues);
          }
        }
        scanned += 1;
      }
      (_a = this.onProgress) == null ? void 0 : _a.call(this, {
        scanned,
        total: files.length
      });
      await this.scheduler.yield();
    }
    return {
      startedAt,
      finishedAt: Date.now(),
      filesScanned: files.length,
      issues,
      breakdown: this.scoreService.calculate(issues, files.length),
      topOffenders: this.computeTopOffenders(issues)
    };
  }
  hasIgnoredTag(tags, ignoredTags) {
    const normalizedTags = new Set(tags.map((tag) => tag.toLowerCase()));
    return ignoredTags.some((tag) => normalizedTags.has(tag.toLowerCase()));
  }
  mergeIssues(existing, incoming, touchedPaths) {
    const touched = new Set(touchedPaths);
    return [...existing.filter((issue) => !touched.has(issue.filePath)), ...incoming];
  }
  computeTopOffenders(issues) {
    var _a;
    const grouped = /* @__PURE__ */ new Map();
    for (const issue of issues) {
      const current = (_a = grouped.get(issue.filePath)) != null ? _a : { impact: 0, issueCount: 0 };
      current.impact += issue.scoreImpact;
      current.issueCount += 1;
      grouped.set(issue.filePath, current);
    }
    return Array.from(grouped.entries()).map(([path, metrics]) => ({
      path,
      impact: metrics.impact,
      issueCount: metrics.issueCount
    })).sort((left, right) => right.impact - left.impact || right.issueCount - left.issueCount).slice(0, 10);
  }
};

// src/ui/views/DashboardView.ts
var import_obsidian = require("obsidian");
var DashboardView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_DASHBOARD;
  }
  getDisplayText() {
    return PLUGIN_NAME;
  }
  getIcon() {
    return "activity";
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    var _a;
    const result = await this.plugin.repository.getLastResult();
    const history = await this.plugin.repository.getHistory();
    this.contentEl.empty();
    this.contentEl.addClass("vha-dashboard");
    const header = this.contentEl.createDiv({ cls: "vha-header" });
    header.createEl("h2", { text: "Vault Health Auditor" });
    const actionRow = header.createDiv({ cls: "vha-actions" });
    const fullAuditButton = actionRow.createEl("button", {
      text: "Run full audit",
      cls: "mod-cta"
    });
    fullAuditButton.addEventListener("click", async () => {
      await this.plugin.runFullAudit();
      await this.render();
    });
    const incrementalButton = actionRow.createEl("button", {
      text: "Run incremental audit"
    });
    incrementalButton.addEventListener("click", async () => {
      await this.plugin.runIncrementalAudit();
      await this.render();
    });
    if (!result) {
      this.contentEl.createEl("p", {
        text: "Nenhuma auditoria foi executada ainda. Rode um full audit para gerar os primeiros resultados."
      });
      return;
    }
    const cards = this.contentEl.createDiv({ cls: "vha-cards" });
    this.createCard(cards, "Health Score", String(result.breakdown.total));
    this.createCard(cards, "Files scanned", String(result.filesScanned));
    this.createCard(cards, "Issues found", String(result.issues.length));
    this.createCard(cards, "Progress", `${this.plugin.progress.scanned}/${this.plugin.progress.total}`);
    const severityBlock = this.contentEl.createDiv({ cls: "vha-block" });
    severityBlock.createEl("h3", { text: "Severity breakdown" });
    severityBlock.createEl("pre", {
      text: JSON.stringify(result.breakdown.issueCountBySeverity, null, 2)
    });
    const categoryBlock = this.contentEl.createDiv({ cls: "vha-block" });
    categoryBlock.createEl("h3", { text: "Category scores" });
    categoryBlock.createEl("pre", {
      text: JSON.stringify(result.breakdown.byCategory, null, 2)
    });
    const offendersBlock = this.contentEl.createDiv({ cls: "vha-block" });
    offendersBlock.createEl("h3", { text: "Top offenders" });
    if (result.topOffenders.length === 0) {
      offendersBlock.createEl("p", { text: "Sem destaques negativos no momento." });
    } else {
      const offendersList = offendersBlock.createEl("ol");
      for (const offender of result.topOffenders) {
        offendersList.createEl("li", {
          text: `${offender.path} \xE2\u20AC\u201D impact ${offender.impact} / ${offender.issueCount} issue(s)`
        });
      }
    }
    const issuesBlock = this.contentEl.createDiv({ cls: "vha-block" });
    issuesBlock.createEl("h3", { text: "Recent issues" });
    if (result.issues.length === 0) {
      issuesBlock.createEl("p", { text: "Nenhuma issue encontrada." });
    } else {
      const issuesList = issuesBlock.createDiv({ cls: "vha-issues" });
      for (const issue of result.issues.slice(0, 50)) {
        const item = issuesList.createDiv({ cls: `vha-issue vha-${issue.severity}` });
        item.createEl("strong", { text: `[${issue.severity.toUpperCase()}] ${issue.title}` });
        item.createEl("div", { text: issue.filePath });
        item.createEl("p", { text: issue.message });
        if ((_a = issue.evidence) == null ? void 0 : _a.length) {
          item.createEl("pre", { text: issue.evidence.join("\n") });
        }
      }
    }
    const historyBlock = this.contentEl.createDiv({ cls: "vha-block" });
    historyBlock.createEl("h3", { text: "History" });
    if (history.length === 0) {
      historyBlock.createEl("p", { text: "Ainda n\xC3\xA3o h\xC3\xA1 hist\xC3\xB3rico persistido." });
    } else {
      const historyList = historyBlock.createEl("ul");
      for (const entry of history.slice(-10).reverse()) {
        historyList.createEl("li", {
          text: `${new Date(entry.timestamp).toLocaleString()} \xE2\u20AC\u201D score ${entry.total}, issues ${entry.issueCount}, files ${entry.filesScanned}`
        });
      }
    }
  }
  createCard(container, title, value) {
    const card = container.createDiv({ cls: "vha-card" });
    card.createEl("small", { text: title });
    card.createEl("h3", { text: value });
  }
};

// src/ui/settings/VaultHealthSettingTab.ts
var import_obsidian2 = require("obsidian");
var VaultHealthSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Vault Health Auditor settings" });
    new import_obsidian2.Setting(containerEl).setName("Run full audit on startup").setDesc("Executa uma auditoria completa sempre que o Obsidian iniciar.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.fullAuditOnStartup).onChange(async (value) => {
        this.plugin.settings.fullAuditOnStartup = value;
        await this.plugin.savePluginSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Custom review field").setDesc("Campo de frontmatter usado como data de revis\xC3\xA3o, por exemplo: reviewed_at").addText(
      (text) => text.setPlaceholder("reviewed_at").setValue(this.plugin.settings.customReviewField).onChange(async (value) => {
        this.plugin.settings.customReviewField = value.trim() || "reviewed_at";
        await this.plugin.savePluginSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Batch size").setDesc("Quantidade de notas processadas por lote.").addText(
      (text) => text.setValue(String(this.plugin.settings.batchSize)).onChange(async (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
          this.plugin.settings.batchSize = parsed;
          await this.plugin.savePluginSettings();
        }
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Large note threshold").setDesc("Quantidade m\xC3\xADnima de palavras para classificar nota como grande.").addText(
      (text) => text.setValue(String(this.plugin.settings.largeNoteWordThreshold)).onChange(async (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
          this.plugin.settings.largeNoteWordThreshold = parsed;
          await this.plugin.savePluginSettings();
        }
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Note type policies (JSON)").setDesc("Edite as pol\xC3\xADticas por tipo de nota em JSON.").addTextArea(
      (text) => text.setPlaceholder("[]").setValue(JSON.stringify(this.plugin.settings.noteTypePolicies, null, 2)).onChange(async (value) => {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) {
            throw new Error("O valor precisa ser um array JSON.");
          }
          this.plugin.settings.noteTypePolicies = parsed;
          await this.plugin.savePluginSettings();
        } catch (error) {
          new import_obsidian2.Notice(`JSON inv\xC3\xA1lido em noteTypePolicies: ${String(error)}`);
        }
      })
    );
  }
};

// src/core/IncrementalIndexer.ts
var IncrementalIndexer = class {
  constructor() {
    this.dirtyPaths = /* @__PURE__ */ new Set();
  }
  markDirty(path) {
    this.dirtyPaths.add(path);
  }
  markDeleted(path) {
    this.dirtyPaths.add(path);
  }
  clear() {
    this.dirtyPaths.clear();
  }
  consumeDirty() {
    const paths = Array.from(this.dirtyPaths);
    this.dirtyPaths.clear();
    return paths;
  }
};

// src/commands/openDashboard.ts
async function openDashboard(plugin) {
  await plugin.ensureDashboardOpen();
}

// src/commands/runFullAudit.ts
async function runFullAuditCommand(plugin) {
  await plugin.runFullAudit();
}

// src/commands/runIncrementalAudit.ts
async function runIncrementalAuditCommand(plugin) {
  await plugin.runIncrementalAudit();
}

// src/utils/logger.ts
var logger = {
  info: (...args) => console.info("[VaultHealthAuditor]", ...args),
  warn: (...args) => console.warn("[VaultHealthAuditor]", ...args),
  error: (...args) => console.error("[VaultHealthAuditor]", ...args)
};

// src/main.ts
var VaultHealthAuditorPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.progress = { scanned: 0, total: 0 };
    this.indexer = new IncrementalIndexer();
    this.running = false;
  }
  async onload() {
    logger.info("Loading plugin");
    this.repository = new AuditRepository(this);
    this.settings = await this.repository.getSettings(DEFAULT_SETTINGS);
    this.engine = this.createEngine();
    this.registerView(
      VIEW_TYPE_DASHBOARD,
      (leaf) => new DashboardView(leaf, this)
    );
    this.addSettingTab(new VaultHealthSettingTab(this.app, this));
    this.addCommand({
      id: "open-dashboard",
      name: "Open audit dashboard",
      callback: () => openDashboard(this)
    });
    this.addCommand({
      id: "run-full-audit",
      name: "Run full audit",
      callback: () => runFullAuditCommand(this)
    });
    this.addCommand({
      id: "run-incremental-audit",
      name: "Run incremental audit",
      callback: () => runIncrementalAuditCommand(this)
    });
    this.registerVaultEvents();
    this.app.workspace.onLayoutReady(async () => {
      if (this.settings.fullAuditOnStartup) {
        await this.runFullAudit();
      }
    });
  }
  onunload() {
    logger.info("Unloading plugin");
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_DASHBOARD);
  }
  async savePluginSettings() {
    await this.repository.saveSettings(this.settings);
    this.engine = this.createEngine();
    await this.refreshDashboardViews();
  }
  async ensureDashboardOpen() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
    let leaf = leaves[0];
    if (!leaf) {
      const newLeaf = this.app.workspace.getRightLeaf(false);
      if (!newLeaf) {
        new import_obsidian3.Notice("N\xE3o foi poss\xEDvel abrir o dashboard.");
        return;
      }
      leaf = newLeaf;
      await leaf.setViewState({
        type: VIEW_TYPE_DASHBOARD,
        active: true
      });
    }
    this.app.workspace.revealLeaf(leaf);
  }
  async runFullAudit() {
    if (this.running) {
      new import_obsidian3.Notice("Uma auditoria j\xC3\xA1 est\xC3\xA1 em execu\xC3\xA7\xC3\xA3o.");
      return;
    }
    try {
      this.running = true;
      this.progress = { scanned: 0, total: 0 };
      new import_obsidian3.Notice("Executando full audit...");
      const result = await this.engine.runFullAudit();
      await this.refreshDashboardViews();
      new import_obsidian3.Notice(`Auditoria conclu\xC3\xADda. Score: ${result.breakdown.total}. Issues: ${result.issues.length}.`);
    } catch (error) {
      logger.error(error);
      new import_obsidian3.Notice(`Erro durante full audit: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
  async runIncrementalAudit() {
    if (this.running) {
      new import_obsidian3.Notice("Uma auditoria j\xC3\xA1 est\xC3\xA1 em execu\xC3\xA7\xC3\xA3o.");
      return;
    }
    const dirtyPaths = this.indexer.consumeDirty();
    if (dirtyPaths.length === 0) {
      new import_obsidian3.Notice("Nenhuma nota modificada desde a \xC3\xBAltima verifica\xC3\xA7\xC3\xA3o incremental.");
      return;
    }
    try {
      this.running = true;
      this.progress = { scanned: 0, total: dirtyPaths.length };
      new import_obsidian3.Notice(`Executando incremental audit em ${dirtyPaths.length} nota(s)...`);
      const result = await this.engine.runIncrementalAudit(dirtyPaths);
      await this.refreshDashboardViews();
      new import_obsidian3.Notice(`Incremental audit conclu\xC3\xADdo. Score atual: ${result.breakdown.total}.`);
    } catch (error) {
      logger.error(error);
      new import_obsidian3.Notice(`Erro durante incremental audit: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
  createEngine() {
    return new AuditEngine(
      this.app,
      new SnapshotBuilder(this.app, () => this.settings),
      new RuleRegistry(),
      new HealthScoreService(),
      this.repository,
      new Scheduler(),
      () => this.settings,
      (progress) => {
        this.progress = progress;
        void this.refreshDashboardViews();
      }
    );
  }
  registerVaultEvents() {
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof import_obsidian3.TFile && file.extension === "md") {
          this.indexer.markDirty(file.path);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof import_obsidian3.TFile && file.extension === "md") {
          this.indexer.markDirty(file.path);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof import_obsidian3.TFile && file.extension === "md") {
          this.indexer.markDirty(file.path);
          this.indexer.markDeleted(oldPath);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof import_obsidian3.TFile && file.extension === "md") {
          this.indexer.markDeleted(file.path);
        }
      })
    );
  }
  async refreshDashboardViews() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
    await Promise.all(
      leaves.map(async (leaf) => {
        const view = leaf.view;
        if (view instanceof DashboardView) {
          await view.render();
        }
      })
    );
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL2NvbnN0YW50cy50cyIsICJzcmMvcGVyc2lzdGVuY2UvZGF0YU1hcHBlcnMudHMiLCAic3JjL3BlcnNpc3RlbmNlL3N0b3JhZ2VTY2hlbWEudHMiLCAic3JjL2NvcmUvQXVkaXRSZXBvc2l0b3J5LnRzIiwgInNyYy91dGlscy9tYXJrZG93bi50cyIsICJzcmMvYW5hbHl6ZXJzL01hcmtkb3duU3RydWN0dXJlQW5hbHl6ZXIudHMiLCAic3JjL3V0aWxzL3RpbWUudHMiLCAic3JjL2NvcmUvU25hcHNob3RCdWlsZGVyLnRzIiwgInNyYy9hbmFseXplcnMvRnJvbnRtYXR0ZXJQb2xpY3lNYXRjaGVyLnRzIiwgInNyYy9ydWxlcy9Ob3RlQWdlUnVsZS50cyIsICJzcmMvYW5hbHl6ZXJzL0xpbmtTdHJlbmd0aEFuYWx5emVyLnRzIiwgInNyYy9ydWxlcy9Ccm9rZW5MaW5rc1J1bGUudHMiLCAic3JjL3J1bGVzL09ycGhhbk5vdGVSdWxlLnRzIiwgInNyYy9ydWxlcy9SZXF1aXJlZEZyb250bWF0dGVyUnVsZS50cyIsICJzcmMvcnVsZXMvTGFyZ2VVbnN0cnVjdHVyZWROb3RlUnVsZS50cyIsICJzcmMvcnVsZXMvRHVtcFBhZ2VSdWxlLnRzIiwgInNyYy9ydWxlcy9NaXNzaW5nU3VtbWFyeVJ1bGUudHMiLCAic3JjL2FuYWx5emVycy9DbGFpbURldGVjdG9yLnRzIiwgInNyYy9ydWxlcy9VbnN1cHBvcnRlZENsYWltc1J1bGUudHMiLCAic3JjL2NvcmUvUnVsZVJlZ2lzdHJ5LnRzIiwgInNyYy9zY29yaW5nL1Njb3JlV2VpZ2h0cy50cyIsICJzcmMvc2NvcmluZy9IZWFsdGhTY29yZVNlcnZpY2UudHMiLCAic3JjL2NvcmUvU2NoZWR1bGVyLnRzIiwgInNyYy91dGlscy9wYXRoLnRzIiwgInNyYy91dGlscy9iYXRjaC50cyIsICJzcmMvY29yZS9BdWRpdEVuZ2luZS50cyIsICJzcmMvdWkvdmlld3MvRGFzaGJvYXJkVmlldy50cyIsICJzcmMvdWkvc2V0dGluZ3MvVmF1bHRIZWFsdGhTZXR0aW5nVGFiLnRzIiwgInNyYy9jb3JlL0luY3JlbWVudGFsSW5kZXhlci50cyIsICJzcmMvY29tbWFuZHMvb3BlbkRhc2hib2FyZC50cyIsICJzcmMvY29tbWFuZHMvcnVuRnVsbEF1ZGl0LnRzIiwgInNyYy9jb21tYW5kcy9ydW5JbmNyZW1lbnRhbEF1ZGl0LnRzIiwgInNyYy91dGlscy9sb2dnZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIlx1RkVGRmltcG9ydCB7IE5vdGljZSwgUGx1Z2luLCBURmlsZSwgV29ya3NwYWNlTGVhZiB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHtcbiAgREVGQVVMVF9TRVRUSU5HUyxcbiAgVklFV19UWVBFX0RBU0hCT0FSRCxcbn0gZnJvbSBcIi4vY29uc3RhbnRzXCI7XG5pbXBvcnQgdHlwZSB7IFZhdWx0SGVhbHRoU2V0dGluZ3MgfSBmcm9tIFwiLi90eXBlcy9zZXR0aW5nc1wiO1xuaW1wb3J0IHsgQXVkaXRSZXBvc2l0b3J5IH0gZnJvbSBcIi4vY29yZS9BdWRpdFJlcG9zaXRvcnlcIjtcbmltcG9ydCB7IFNuYXBzaG90QnVpbGRlciB9IGZyb20gXCIuL2NvcmUvU25hcHNob3RCdWlsZGVyXCI7XG5pbXBvcnQgeyBSdWxlUmVnaXN0cnkgfSBmcm9tIFwiLi9jb3JlL1J1bGVSZWdpc3RyeVwiO1xuaW1wb3J0IHsgSGVhbHRoU2NvcmVTZXJ2aWNlIH0gZnJvbSBcIi4vc2NvcmluZy9IZWFsdGhTY29yZVNlcnZpY2VcIjtcbmltcG9ydCB7IFNjaGVkdWxlciB9IGZyb20gXCIuL2NvcmUvU2NoZWR1bGVyXCI7XG5pbXBvcnQgeyBBdWRpdEVuZ2luZSB9IGZyb20gXCIuL2NvcmUvQXVkaXRFbmdpbmVcIjtcbmltcG9ydCB7IERhc2hib2FyZFZpZXcgfSBmcm9tIFwiLi91aS92aWV3cy9EYXNoYm9hcmRWaWV3XCI7XG5pbXBvcnQgeyBWYXVsdEhlYWx0aFNldHRpbmdUYWIgfSBmcm9tIFwiLi91aS9zZXR0aW5ncy9WYXVsdEhlYWx0aFNldHRpbmdUYWJcIjtcbmltcG9ydCB7IEluY3JlbWVudGFsSW5kZXhlciB9IGZyb20gXCIuL2NvcmUvSW5jcmVtZW50YWxJbmRleGVyXCI7XG5pbXBvcnQgeyBvcGVuRGFzaGJvYXJkIH0gZnJvbSBcIi4vY29tbWFuZHMvb3BlbkRhc2hib2FyZFwiO1xuaW1wb3J0IHsgcnVuRnVsbEF1ZGl0Q29tbWFuZCB9IGZyb20gXCIuL2NvbW1hbmRzL3J1bkZ1bGxBdWRpdFwiO1xuaW1wb3J0IHsgcnVuSW5jcmVtZW50YWxBdWRpdENvbW1hbmQgfSBmcm9tIFwiLi9jb21tYW5kcy9ydW5JbmNyZW1lbnRhbEF1ZGl0XCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi91dGlscy9sb2dnZXJcIjtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVmF1bHRIZWFsdGhBdWRpdG9yUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3M6IFZhdWx0SGVhbHRoU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xuICByZXBvc2l0b3J5ITogQXVkaXRSZXBvc2l0b3J5O1xuICBwcm9ncmVzcyA9IHsgc2Nhbm5lZDogMCwgdG90YWw6IDAgfTtcblxuICBwcml2YXRlIHJlYWRvbmx5IGluZGV4ZXIgPSBuZXcgSW5jcmVtZW50YWxJbmRleGVyKCk7XG4gIHByaXZhdGUgZW5naW5lITogQXVkaXRFbmdpbmU7XG4gIHByaXZhdGUgcnVubmluZyA9IGZhbHNlO1xuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBsb2dnZXIuaW5mbyhcIkxvYWRpbmcgcGx1Z2luXCIpO1xuXG4gICAgdGhpcy5yZXBvc2l0b3J5ID0gbmV3IEF1ZGl0UmVwb3NpdG9yeSh0aGlzKTtcbiAgICB0aGlzLnNldHRpbmdzID0gYXdhaXQgdGhpcy5yZXBvc2l0b3J5LmdldFNldHRpbmdzKERFRkFVTFRfU0VUVElOR1MpO1xuICAgIHRoaXMuZW5naW5lID0gdGhpcy5jcmVhdGVFbmdpbmUoKTtcblxuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFxuICAgICAgVklFV19UWVBFX0RBU0hCT0FSRCxcbiAgICAgIChsZWFmKSA9PiBuZXcgRGFzaGJvYXJkVmlldyhsZWFmLCB0aGlzKSxcbiAgICApO1xuXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBWYXVsdEhlYWx0aFNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJvcGVuLWRhc2hib2FyZFwiLFxuICAgICAgbmFtZTogXCJPcGVuIGF1ZGl0IGRhc2hib2FyZFwiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IG9wZW5EYXNoYm9hcmQodGhpcyksXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwicnVuLWZ1bGwtYXVkaXRcIixcbiAgICAgIG5hbWU6IFwiUnVuIGZ1bGwgYXVkaXRcIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiBydW5GdWxsQXVkaXRDb21tYW5kKHRoaXMpLFxuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInJ1bi1pbmNyZW1lbnRhbC1hdWRpdFwiLFxuICAgICAgbmFtZTogXCJSdW4gaW5jcmVtZW50YWwgYXVkaXRcIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiBydW5JbmNyZW1lbnRhbEF1ZGl0Q29tbWFuZCh0aGlzKSxcbiAgICB9KTtcblxuICAgIHRoaXMucmVnaXN0ZXJWYXVsdEV2ZW50cygpO1xuXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoYXN5bmMgKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuc2V0dGluZ3MuZnVsbEF1ZGl0T25TdGFydHVwKSB7XG4gICAgICAgIGF3YWl0IHRoaXMucnVuRnVsbEF1ZGl0KCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICBsb2dnZXIuaW5mbyhcIlVubG9hZGluZyBwbHVnaW5cIik7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShWSUVXX1RZUEVfREFTSEJPQVJEKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVQbHVnaW5TZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLnJlcG9zaXRvcnkuc2F2ZVNldHRpbmdzKHRoaXMuc2V0dGluZ3MpO1xuICAgIHRoaXMuZW5naW5lID0gdGhpcy5jcmVhdGVFbmdpbmUoKTtcbiAgICBhd2FpdCB0aGlzLnJlZnJlc2hEYXNoYm9hcmRWaWV3cygpO1xuICB9XG5cbiAgYXN5bmMgZW5zdXJlRGFzaGJvYXJkT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBsZWF2ZXMgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9EQVNIQk9BUkQpO1xuICAgIGxldCBsZWFmID0gbGVhdmVzWzBdO1xuXG4gICAgaWYgKCFsZWFmKSB7XG4gICAgICBjb25zdCBuZXdMZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldFJpZ2h0TGVhZihmYWxzZSk7XG5cbiAgICAgIGlmICghbmV3TGVhZikge1xuICAgICAgICBuZXcgTm90aWNlKFwiTlx1MDBFM28gZm9pIHBvc3NcdTAwRUR2ZWwgYWJyaXIgbyBkYXNoYm9hcmQuXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGxlYWYgPSBuZXdMZWFmO1xuXG4gICAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7XG4gICAgICAgIHR5cGU6IFZJRVdfVFlQRV9EQVNIQk9BUkQsXG4gICAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGxlYWYpO1xuICB9XG5cbiAgYXN5bmMgcnVuRnVsbEF1ZGl0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLnJ1bm5pbmcpIHtcbiAgICAgIG5ldyBOb3RpY2UoXCJVbWEgYXVkaXRvcmlhIGpcdTAwQzNcdTAwQTEgZXN0XHUwMEMzXHUwMEExIGVtIGV4ZWN1XHUwMEMzXHUwMEE3XHUwMEMzXHUwMEEzby5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIHRoaXMucnVubmluZyA9IHRydWU7XG4gICAgICB0aGlzLnByb2dyZXNzID0geyBzY2FubmVkOiAwLCB0b3RhbDogMCB9O1xuICAgICAgbmV3IE5vdGljZShcIkV4ZWN1dGFuZG8gZnVsbCBhdWRpdC4uLlwiKTtcblxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5lbmdpbmUucnVuRnVsbEF1ZGl0KCk7XG4gICAgICBhd2FpdCB0aGlzLnJlZnJlc2hEYXNoYm9hcmRWaWV3cygpO1xuXG4gICAgICBuZXcgTm90aWNlKGBBdWRpdG9yaWEgY29uY2x1XHUwMEMzXHUwMEFEZGEuIFNjb3JlOiAke3Jlc3VsdC5icmVha2Rvd24udG90YWx9LiBJc3N1ZXM6ICR7cmVzdWx0Lmlzc3Vlcy5sZW5ndGh9LmApO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBsb2dnZXIuZXJyb3IoZXJyb3IpO1xuICAgICAgbmV3IE5vdGljZShgRXJybyBkdXJhbnRlIGZ1bGwgYXVkaXQ6ICR7U3RyaW5nKGVycm9yKX1gKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgdGhpcy5ydW5uaW5nID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcnVuSW5jcmVtZW50YWxBdWRpdCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy5ydW5uaW5nKSB7XG4gICAgICBuZXcgTm90aWNlKFwiVW1hIGF1ZGl0b3JpYSBqXHUwMEMzXHUwMEExIGVzdFx1MDBDM1x1MDBBMSBlbSBleGVjdVx1MDBDM1x1MDBBN1x1MDBDM1x1MDBBM28uXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGRpcnR5UGF0aHMgPSB0aGlzLmluZGV4ZXIuY29uc3VtZURpcnR5KCk7XG4gICAgaWYgKGRpcnR5UGF0aHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBuZXcgTm90aWNlKFwiTmVuaHVtYSBub3RhIG1vZGlmaWNhZGEgZGVzZGUgYSBcdTAwQzNcdTAwQkFsdGltYSB2ZXJpZmljYVx1MDBDM1x1MDBBN1x1MDBDM1x1MDBBM28gaW5jcmVtZW50YWwuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICB0aGlzLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgdGhpcy5wcm9ncmVzcyA9IHsgc2Nhbm5lZDogMCwgdG90YWw6IGRpcnR5UGF0aHMubGVuZ3RoIH07XG4gICAgICBuZXcgTm90aWNlKGBFeGVjdXRhbmRvIGluY3JlbWVudGFsIGF1ZGl0IGVtICR7ZGlydHlQYXRocy5sZW5ndGh9IG5vdGEocykuLi5gKTtcblxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5lbmdpbmUucnVuSW5jcmVtZW50YWxBdWRpdChkaXJ0eVBhdGhzKTtcbiAgICAgIGF3YWl0IHRoaXMucmVmcmVzaERhc2hib2FyZFZpZXdzKCk7XG5cbiAgICAgIG5ldyBOb3RpY2UoYEluY3JlbWVudGFsIGF1ZGl0IGNvbmNsdVx1MDBDM1x1MDBBRGRvLiBTY29yZSBhdHVhbDogJHtyZXN1bHQuYnJlYWtkb3duLnRvdGFsfS5gKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgbG9nZ2VyLmVycm9yKGVycm9yKTtcbiAgICAgIG5ldyBOb3RpY2UoYEVycm8gZHVyYW50ZSBpbmNyZW1lbnRhbCBhdWRpdDogJHtTdHJpbmcoZXJyb3IpfWApO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUVuZ2luZSgpOiBBdWRpdEVuZ2luZSB7XG4gICAgcmV0dXJuIG5ldyBBdWRpdEVuZ2luZShcbiAgICAgIHRoaXMuYXBwLFxuICAgICAgbmV3IFNuYXBzaG90QnVpbGRlcih0aGlzLmFwcCwgKCkgPT4gdGhpcy5zZXR0aW5ncyksXG4gICAgICBuZXcgUnVsZVJlZ2lzdHJ5KCksXG4gICAgICBuZXcgSGVhbHRoU2NvcmVTZXJ2aWNlKCksXG4gICAgICB0aGlzLnJlcG9zaXRvcnksXG4gICAgICBuZXcgU2NoZWR1bGVyKCksXG4gICAgICAoKSA9PiB0aGlzLnNldHRpbmdzLFxuICAgICAgKHByb2dyZXNzKSA9PiB7XG4gICAgICAgIHRoaXMucHJvZ3Jlc3MgPSBwcm9ncmVzcztcbiAgICAgICAgdm9pZCB0aGlzLnJlZnJlc2hEYXNoYm9hcmRWaWV3cygpO1xuICAgICAgfSxcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSByZWdpc3RlclZhdWx0RXZlbnRzKCk6IHZvaWQge1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKFwibW9kaWZ5XCIsIChmaWxlKSA9PiB7XG4gICAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUgJiYgZmlsZS5leHRlbnNpb24gPT09IFwibWRcIikge1xuICAgICAgICAgIHRoaXMuaW5kZXhlci5tYXJrRGlydHkoZmlsZS5wYXRoKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKFwiY3JlYXRlXCIsIChmaWxlKSA9PiB7XG4gICAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUgJiYgZmlsZS5leHRlbnNpb24gPT09IFwibWRcIikge1xuICAgICAgICAgIHRoaXMuaW5kZXhlci5tYXJrRGlydHkoZmlsZS5wYXRoKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKFwicmVuYW1lXCIsIChmaWxlLCBvbGRQYXRoKSA9PiB7XG4gICAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUgJiYgZmlsZS5leHRlbnNpb24gPT09IFwibWRcIikge1xuICAgICAgICAgIHRoaXMuaW5kZXhlci5tYXJrRGlydHkoZmlsZS5wYXRoKTtcbiAgICAgICAgICB0aGlzLmluZGV4ZXIubWFya0RlbGV0ZWQob2xkUGF0aCk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC52YXVsdC5vbihcImRlbGV0ZVwiLCAoZmlsZSkgPT4ge1xuICAgICAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlICYmIGZpbGUuZXh0ZW5zaW9uID09PSBcIm1kXCIpIHtcbiAgICAgICAgICB0aGlzLmluZGV4ZXIubWFya0RlbGV0ZWQoZmlsZS5wYXRoKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVmcmVzaERhc2hib2FyZFZpZXdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGxlYXZlcyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFX0RBU0hCT0FSRCk7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICBsZWF2ZXMubWFwKGFzeW5jIChsZWFmKSA9PiB7XG4gICAgICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXc7XG4gICAgICAgIGlmICh2aWV3IGluc3RhbmNlb2YgRGFzaGJvYXJkVmlldykge1xuICAgICAgICAgIGF3YWl0IHZpZXcucmVuZGVyKCk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbn1cbiIsICJcdUZFRkZpbXBvcnQgdHlwZSB7IFZhdWx0SGVhbHRoU2V0dGluZ3MgfSBmcm9tIFwiLi90eXBlcy9zZXR0aW5nc1wiO1xuXG5leHBvcnQgY29uc3QgUExVR0lOX0lEID0gXCJ2YXVsdC1oZWFsdGgtYXVkaXRvclwiO1xuZXhwb3J0IGNvbnN0IFBMVUdJTl9OQU1FID0gXCJWYXVsdCBIZWFsdGggQXVkaXRvclwiO1xuZXhwb3J0IGNvbnN0IFZJRVdfVFlQRV9EQVNIQk9BUkQgPSBcInZhdWx0LWhlYWx0aC1hdWRpdG9yLWRhc2hib2FyZFwiO1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogVmF1bHRIZWFsdGhTZXR0aW5ncyA9IHtcbiAgZW5hYmxlZFJ1bGVzOiBbXG4gICAgXCJub3RlLWFnZVwiLFxuICAgIFwiYnJva2VuLWxpbmtzXCIsXG4gICAgXCJvcnBoYW4tbm90ZVwiLFxuICAgIFwicmVxdWlyZWQtZnJvbnRtYXR0ZXJcIixcbiAgICBcImxhcmdlLXVuc3RydWN0dXJlZC1ub3RlXCIsXG4gICAgXCJkdW1wLXBhZ2VcIixcbiAgICBcIm1pc3Npbmctc3VtbWFyeVwiLFxuICAgIFwidW5zdXBwb3J0ZWQtY2xhaW1zXCIsXG4gIF0sXG4gIG5vdGVUeXBlUG9saWNpZXM6IFtcbiAgICB7XG4gICAgICBub3RlVHlwZTogXCJib29rXCIsXG4gICAgICByZXF1aXJlZEZyb250bWF0dGVyOiBbXCJhdXRob3JcIiwgXCJ5ZWFyXCIsIFwic3RhdHVzXCJdLFxuICAgICAgc3VtbWFyeVJlcXVpcmVkOiB0cnVlLFxuICAgICAgc3RhbGVBZnRlckRheXM6IDkwLFxuICAgIH0sXG4gICAge1xuICAgICAgbm90ZVR5cGU6IFwiYXJ0aWNsZVwiLFxuICAgICAgcmVxdWlyZWRGcm9udG1hdHRlcjogW1wiYXV0aG9yXCIsIFwic291cmNlXCIsIFwicHVibGlzaGVkXCJdLFxuICAgICAgc3VtbWFyeVJlcXVpcmVkOiB0cnVlLFxuICAgICAgc3RhbGVBZnRlckRheXM6IDYwLFxuICAgIH0sXG4gICAge1xuICAgICAgbm90ZVR5cGU6IFwicGVybWFuZW50XCIsXG4gICAgICByZXF1aXJlZEZyb250bWF0dGVyOiBbXCJzdW1tYXJ5XCJdLFxuICAgICAgc3VtbWFyeVJlcXVpcmVkOiB0cnVlLFxuICAgICAgc3RhbGVBZnRlckRheXM6IDEyMCxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5vdGVUeXBlOiBcImZsZWV0aW5nXCIsXG4gICAgICByZXF1aXJlZEZyb250bWF0dGVyOiBbXSxcbiAgICAgIHN1bW1hcnlSZXF1aXJlZDogZmFsc2UsXG4gICAgICBzdGFsZUFmdGVyRGF5czogMTQsXG4gICAgfSxcbiAgXSxcbiAgaWdub3JlZEZvbGRlcnM6IFtcIi5vYnNpZGlhblwiLCBcIlRlbXBsYXRlc1wiXSxcbiAgaWdub3JlZFRhZ3M6IFtcIm5vLWF1ZGl0XCJdLFxuICBsYXJnZU5vdGVXb3JkVGhyZXNob2xkOiAxMjAwLFxuICBkdW1wUGFnZUxpbmtUaHJlc2hvbGQ6IDM1LFxuICBkdW1wUGFnZVBhcmFncmFwaERlbnNpdHlNaW46IDAuMDE1LFxuICBmdWxsQXVkaXRPblN0YXJ0dXA6IGZhbHNlLFxuICBtYXhDb25jdXJyZW50UmVhZHM6IDQsXG4gIGJhdGNoU2l6ZTogNzUsXG4gIGN1c3RvbVJldmlld0ZpZWxkOiBcInJldmlld2VkX2F0XCIsXG59O1xyXG4iLCAiXHVGRUZGaW1wb3J0IHR5cGUgeyBWYXVsdEF1ZGl0UmVzdWx0IH0gZnJvbSBcIi4uL3R5cGVzL2F1ZGl0XCI7XG5pbXBvcnQgdHlwZSB7IFN0b3JlZEF1ZGl0SGlzdG9yeUVudHJ5IH0gZnJvbSBcIi4vc3RvcmFnZVNjaGVtYVwiO1xuXG5leHBvcnQgZnVuY3Rpb24gZGVlcENsb25lPFQ+KHZhbHVlOiBUKTogVCB7XG4gIHJldHVybiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHZhbHVlKSkgYXMgVDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvSGlzdG9yeUVudHJ5KHJlc3VsdDogVmF1bHRBdWRpdFJlc3VsdCk6IFN0b3JlZEF1ZGl0SGlzdG9yeUVudHJ5IHtcbiAgcmV0dXJuIHtcbiAgICB0aW1lc3RhbXA6IHJlc3VsdC5maW5pc2hlZEF0LFxuICAgIHRvdGFsOiByZXN1bHQuYnJlYWtkb3duLnRvdGFsLFxuICAgIGlzc3VlQ291bnQ6IHJlc3VsdC5pc3N1ZXMubGVuZ3RoLFxuICAgIGZpbGVzU2Nhbm5lZDogcmVzdWx0LmZpbGVzU2Nhbm5lZCxcbiAgfTtcbn1cclxuIiwgIlx1RkVGRmltcG9ydCB7IERFRkFVTFRfU0VUVElOR1MgfSBmcm9tIFwiLi4vY29uc3RhbnRzXCI7XG5pbXBvcnQgdHlwZSB7IFZhdWx0QXVkaXRSZXN1bHQgfSBmcm9tIFwiLi4vdHlwZXMvYXVkaXRcIjtcbmltcG9ydCB0eXBlIHsgVmF1bHRIZWFsdGhTZXR0aW5ncyB9IGZyb20gXCIuLi90eXBlcy9zZXR0aW5nc1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFN0b3JlZEF1ZGl0SGlzdG9yeUVudHJ5IHtcbiAgdGltZXN0YW1wOiBudW1iZXI7XG4gIHRvdGFsOiBudW1iZXI7XG4gIGlzc3VlQ291bnQ6IG51bWJlcjtcbiAgZmlsZXNTY2FubmVkOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3RvcmVkQXVkaXREYXRhIHtcbiAgbGFzdFJlc3VsdDogVmF1bHRBdWRpdFJlc3VsdCB8IG51bGw7XG4gIGhpc3Rvcnk6IFN0b3JlZEF1ZGl0SGlzdG9yeUVudHJ5W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGx1Z2luU3RvcmFnZURhdGEge1xuICBzZXR0aW5nczogVmF1bHRIZWFsdGhTZXR0aW5ncztcbiAgYXVkaXQ6IFN0b3JlZEF1ZGl0RGF0YTtcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU1RPUkFHRV9EQVRBOiBQbHVnaW5TdG9yYWdlRGF0YSA9IHtcbiAgc2V0dGluZ3M6IERFRkFVTFRfU0VUVElOR1MsXG4gIGF1ZGl0OiB7XG4gICAgbGFzdFJlc3VsdDogbnVsbCxcbiAgICBoaXN0b3J5OiBbXSxcbiAgfSxcbn07XHJcbiIsICJcdUZFRkZpbXBvcnQgdHlwZSB7IFBsdWdpbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgREVGQVVMVF9TRVRUSU5HUyB9IGZyb20gXCIuLi9jb25zdGFudHNcIjtcbmltcG9ydCB0eXBlIHsgVmF1bHRBdWRpdFJlc3VsdCB9IGZyb20gXCIuLi90eXBlcy9hdWRpdFwiO1xuaW1wb3J0IHR5cGUgeyBWYXVsdEhlYWx0aFNldHRpbmdzIH0gZnJvbSBcIi4uL3R5cGVzL3NldHRpbmdzXCI7XG5pbXBvcnQgeyBkZWVwQ2xvbmUsIHRvSGlzdG9yeUVudHJ5IH0gZnJvbSBcIi4uL3BlcnNpc3RlbmNlL2RhdGFNYXBwZXJzXCI7XG5pbXBvcnQge1xuICBERUZBVUxUX1NUT1JBR0VfREFUQSxcbiAgdHlwZSBQbHVnaW5TdG9yYWdlRGF0YSxcbiAgdHlwZSBTdG9yZWRBdWRpdEhpc3RvcnlFbnRyeSxcbn0gZnJvbSBcIi4uL3BlcnNpc3RlbmNlL3N0b3JhZ2VTY2hlbWFcIjtcblxuZXhwb3J0IGNsYXNzIEF1ZGl0UmVwb3NpdG9yeSB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgcGx1Z2luOiBQbHVnaW4pIHt9XG5cbiAgcHJpdmF0ZSBhc3luYyByZWFkKCk6IFByb21pc2U8UGx1Z2luU3RvcmFnZURhdGE+IHtcbiAgICBjb25zdCByYXcgPSBhd2FpdCB0aGlzLnBsdWdpbi5sb2FkRGF0YSgpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHNldHRpbmdzOiB7XG4gICAgICAgIC4uLkRFRkFVTFRfU0VUVElOR1MsXG4gICAgICAgIC4uLihyYXc/LnNldHRpbmdzID8/IHt9KSxcbiAgICAgIH0sXG4gICAgICBhdWRpdDoge1xuICAgICAgICBsYXN0UmVzdWx0OiByYXc/LmF1ZGl0Py5sYXN0UmVzdWx0ID8/IERFRkFVTFRfU1RPUkFHRV9EQVRBLmF1ZGl0Lmxhc3RSZXN1bHQsXG4gICAgICAgIGhpc3Rvcnk6IHJhdz8uYXVkaXQ/Lmhpc3RvcnkgPz8gREVGQVVMVF9TVE9SQUdFX0RBVEEuYXVkaXQuaGlzdG9yeSxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIGFzeW5jIGdldFNldHRpbmdzKGZhbGxiYWNrOiBWYXVsdEhlYWx0aFNldHRpbmdzID0gREVGQVVMVF9TRVRUSU5HUyk6IFByb21pc2U8VmF1bHRIZWFsdGhTZXR0aW5ncz4ge1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLnJlYWQoKTtcbiAgICByZXR1cm4ge1xuICAgICAgLi4uZmFsbGJhY2ssXG4gICAgICAuLi5kZWVwQ2xvbmUoZGF0YS5zZXR0aW5ncyksXG4gICAgfTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncyhzZXR0aW5nczogVmF1bHRIZWFsdGhTZXR0aW5ncyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLnJlYWQoKTtcbiAgICBkYXRhLnNldHRpbmdzID0gZGVlcENsb25lKHNldHRpbmdzKTtcbiAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlRGF0YShkYXRhKTtcbiAgfVxuXG4gIGFzeW5jIGdldExhc3RSZXN1bHQoKTogUHJvbWlzZTxWYXVsdEF1ZGl0UmVzdWx0IHwgbnVsbD4ge1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLnJlYWQoKTtcbiAgICByZXR1cm4gZGF0YS5hdWRpdC5sYXN0UmVzdWx0ID8gZGVlcENsb25lKGRhdGEuYXVkaXQubGFzdFJlc3VsdCkgOiBudWxsO1xuICB9XG5cbiAgYXN5bmMgZ2V0SGlzdG9yeSgpOiBQcm9taXNlPFN0b3JlZEF1ZGl0SGlzdG9yeUVudHJ5W10+IHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5yZWFkKCk7XG4gICAgcmV0dXJuIGRlZXBDbG9uZShkYXRhLmF1ZGl0Lmhpc3RvcnkpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVJlc3VsdChyZXN1bHQ6IFZhdWx0QXVkaXRSZXN1bHQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5yZWFkKCk7XG4gICAgZGF0YS5hdWRpdC5sYXN0UmVzdWx0ID0gZGVlcENsb25lKHJlc3VsdCk7XG4gICAgZGF0YS5hdWRpdC5oaXN0b3J5ID0gWy4uLmRhdGEuYXVkaXQuaGlzdG9yeSwgdG9IaXN0b3J5RW50cnkocmVzdWx0KV0uc2xpY2UoLTMwKTtcbiAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlRGF0YShkYXRhKTtcbiAgfVxufVxyXG4iLCAiXHVGRUZGZXhwb3J0IGZ1bmN0aW9uIHN0cmlwRnJvbnRtYXR0ZXIobWFya2Rvd246IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICghbWFya2Rvd24uc3RhcnRzV2l0aChcIi0tLVwiKSkge1xuICAgIHJldHVybiBtYXJrZG93bjtcbiAgfVxuXG4gIGNvbnN0IGVuZEluZGV4ID0gbWFya2Rvd24uaW5kZXhPZihcIlxcbi0tLVwiLCAzKTtcbiAgaWYgKGVuZEluZGV4ID09PSAtMSkge1xuICAgIHJldHVybiBtYXJrZG93bjtcbiAgfVxuXG4gIHJldHVybiBtYXJrZG93bi5zbGljZShlbmRJbmRleCArIDQpLnRyaW1TdGFydCgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UGFyYWdyYXBocyhtYXJrZG93bjogc3RyaW5nKTogc3RyaW5nW10ge1xuICByZXR1cm4gc3RyaXBGcm9udG1hdHRlcihtYXJrZG93bilcbiAgICAuc3BsaXQoL1xcblxccypcXG4vZylcbiAgICAubWFwKChjaHVuaykgPT4gY2h1bmsudHJpbSgpKVxuICAgIC5maWx0ZXIoKGNodW5rKSA9PiBjaHVuay5sZW5ndGggPiAwKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFdvcmRDb3VudChtYXJrZG93bjogc3RyaW5nKTogbnVtYmVyIHtcbiAgcmV0dXJuIHN0cmlwRnJvbnRtYXR0ZXIobWFya2Rvd24pXG4gICAgLnJlcGxhY2UoL1xcW1xcWy4qP1xcXVxcXS9nLCBcIiBcIilcbiAgICAucmVwbGFjZSgvXFxbLio/XFxdXFwoLio/XFwpL2csIFwiIFwiKVxuICAgIC5zcGxpdCgvXFxzKy8pXG4gICAgLmZpbHRlcihCb29sZWFuKS5sZW5ndGg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRMaW5lQ291bnQobWFya2Rvd246IHN0cmluZyk6IG51bWJlciB7XG4gIHJldHVybiBtYXJrZG93bi5zcGxpdCgvXFxyP1xcbi8pLmxlbmd0aDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhhc0ludHJvU3VtbWFyeShtYXJrZG93bjogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IHBhcmFncmFwaHMgPSBnZXRQYXJhZ3JhcGhzKG1hcmtkb3duKTtcbiAgaWYgKHBhcmFncmFwaHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgZmlyc3RQYXJhZ3JhcGggPSBwYXJhZ3JhcGhzLmZpbmQoKHBhcmFncmFwaCkgPT4gIXBhcmFncmFwaC5zdGFydHNXaXRoKFwiI1wiKSk7XG4gIGlmICghZmlyc3RQYXJhZ3JhcGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoL15zdW1tYXJ5XFxzKjovaS50ZXN0KGZpcnN0UGFyYWdyYXBoKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGZpcnN0UGFyYWdyYXBoLmxlbmd0aCA+PSA4MDtcbn1cclxuIiwgIlx1RkVGRmltcG9ydCB7XG4gIGdldExpbmVDb3VudCxcbiAgZ2V0UGFyYWdyYXBocyxcbiAgZ2V0V29yZENvdW50LFxuICBoYXNJbnRyb1N1bW1hcnksXG4gIHN0cmlwRnJvbnRtYXR0ZXIsXG59IGZyb20gXCIuLi91dGlscy9tYXJrZG93blwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1hcmtkb3duU3RydWN0dXJlUmVwb3J0IHtcbiAgaGVhZGluZ0NvdW50OiBudW1iZXI7XG4gIHBhcmFncmFwaENvdW50OiBudW1iZXI7XG4gIHdvcmRDb3VudDogbnVtYmVyO1xuICBsaW5lQ291bnQ6IG51bWJlcjtcbiAgaGFzU3VtbWFyeTogYm9vbGVhbjtcbiAgcGFyYWdyYXBoRGVuc2l0eTogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgTWFya2Rvd25TdHJ1Y3R1cmVBbmFseXplciB7XG4gIGFuYWx5emUobWFya2Rvd246IHN0cmluZyk6IE1hcmtkb3duU3RydWN0dXJlUmVwb3J0IHtcbiAgICBjb25zdCBzdHJpcHBlZCA9IHN0cmlwRnJvbnRtYXR0ZXIobWFya2Rvd24pO1xuICAgIGNvbnN0IGxpbmVzID0gc3RyaXBwZWQuc3BsaXQoL1xccj9cXG4vKTtcbiAgICBjb25zdCBwYXJhZ3JhcGhzID0gZ2V0UGFyYWdyYXBocyhtYXJrZG93bik7XG4gICAgY29uc3QgaGVhZGluZ0NvdW50ID0gbGluZXMuZmlsdGVyKChsaW5lKSA9PiAvXiN7MSw2fVxccysvLnRlc3QobGluZSkpLmxlbmd0aDtcbiAgICBjb25zdCB3b3JkQ291bnQgPSBnZXRXb3JkQ291bnQobWFya2Rvd24pO1xuICAgIGNvbnN0IGxpbmVDb3VudCA9IGdldExpbmVDb3VudChtYXJrZG93bik7XG4gICAgY29uc3QgcGFyYWdyYXBoQ291bnQgPSBwYXJhZ3JhcGhzLmxlbmd0aDtcbiAgICBjb25zdCBwYXJhZ3JhcGhEZW5zaXR5ID0gd29yZENvdW50ID4gMCA/IHBhcmFncmFwaENvdW50IC8gd29yZENvdW50IDogMDtcblxuICAgIHJldHVybiB7XG4gICAgICBoZWFkaW5nQ291bnQsXG4gICAgICBwYXJhZ3JhcGhDb3VudCxcbiAgICAgIHdvcmRDb3VudCxcbiAgICAgIGxpbmVDb3VudCxcbiAgICAgIGhhc1N1bW1hcnk6IGhhc0ludHJvU3VtbWFyeShtYXJrZG93biksXG4gICAgICBwYXJhZ3JhcGhEZW5zaXR5LFxuICAgIH07XG4gIH1cbn1cclxuIiwgIlx1RkVGRmV4cG9ydCBjb25zdCBEQVlfTVMgPSAxMDAwICogNjAgKiA2MCAqIDI0O1xuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VEYXRlTGlrZSh2YWx1ZTogdW5rbm93bik6IG51bWJlciB8IG51bGwge1xuICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJudW1iZXJcIiAmJiBOdW1iZXIuaXNGaW5pdGUodmFsdWUpKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IHBhcnNlZCA9IERhdGUucGFyc2UodmFsdWUpO1xuICAgIHJldHVybiBOdW1iZXIuaXNOYU4ocGFyc2VkKSA/IG51bGwgOiBwYXJzZWQ7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRpZmZEYXlzKGZyb21UaW1lc3RhbXA6IG51bWJlciwgdG9UaW1lc3RhbXA6IG51bWJlcik6IG51bWJlciB7XG4gIHJldHVybiBNYXRoLmZsb29yKCh0b1RpbWVzdGFtcCAtIGZyb21UaW1lc3RhbXApIC8gREFZX01TKTtcbn1cclxuIiwgIlx1RkVGRmltcG9ydCB7IEFwcCwgVEZpbGUgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIHsgVmF1bHRJbmRleCB9IGZyb20gXCIuLi90eXBlcy9hdWRpdFwiO1xuaW1wb3J0IHR5cGUgeyBOb3RlU25hcHNob3QgfSBmcm9tIFwiLi4vdHlwZXMvc25hcHNob3RcIjtcbmltcG9ydCB0eXBlIHsgVmF1bHRIZWFsdGhTZXR0aW5ncyB9IGZyb20gXCIuLi90eXBlcy9zZXR0aW5nc1wiO1xuaW1wb3J0IHsgTWFya2Rvd25TdHJ1Y3R1cmVBbmFseXplciB9IGZyb20gXCIuLi9hbmFseXplcnMvTWFya2Rvd25TdHJ1Y3R1cmVBbmFseXplclwiO1xuaW1wb3J0IHsgcGFyc2VEYXRlTGlrZSB9IGZyb20gXCIuLi91dGlscy90aW1lXCI7XG5cbmV4cG9ydCBjbGFzcyBTbmFwc2hvdEJ1aWxkZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IHN0cnVjdHVyZUFuYWx5emVyID0gbmV3IE1hcmtkb3duU3RydWN0dXJlQW5hbHl6ZXIoKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IGFwcDogQXBwLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgc2V0dGluZ3NQcm92aWRlcjogKCkgPT4gVmF1bHRIZWFsdGhTZXR0aW5ncyxcbiAgKSB7fVxuXG4gIGFzeW5jIGJ1aWxkKGZpbGU6IFRGaWxlLCBpbmRleDogVmF1bHRJbmRleCwgaW5jbHVkZUNvbnRlbnQ6IGJvb2xlYW4pOiBQcm9taXNlPE5vdGVTbmFwc2hvdD4ge1xuICAgIGNvbnN0IGNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG4gICAgY29uc3QgZnJvbnRtYXR0ZXIgPSAoY2FjaGU/LmZyb250bWF0dGVyID8/IHt9KSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgICBjb25zdCByZXZpZXdGaWVsZCA9IHRoaXMuc2V0dGluZ3NQcm92aWRlcigpLmN1c3RvbVJldmlld0ZpZWxkO1xuICAgIGNvbnN0IHJhd0NvbnRlbnQgPSBpbmNsdWRlQ29udGVudCA/IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSkgOiB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBzdHJ1Y3R1cmUgPSByYXdDb250ZW50XG4gICAgICA/IHRoaXMuc3RydWN0dXJlQW5hbHl6ZXIuYW5hbHl6ZShyYXdDb250ZW50KVxuICAgICAgOiB7XG4gICAgICAgICAgaGVhZGluZ0NvdW50OiBjYWNoZT8uaGVhZGluZ3M/Lmxlbmd0aCA/PyAwLFxuICAgICAgICAgIHBhcmFncmFwaENvdW50OiAwLFxuICAgICAgICAgIHdvcmRDb3VudDogMCxcbiAgICAgICAgICBsaW5lQ291bnQ6IDAsXG4gICAgICAgICAgaGFzU3VtbWFyeTogQm9vbGVhbihmcm9udG1hdHRlci5zdW1tYXJ5KSxcbiAgICAgICAgICBwYXJhZ3JhcGhEZW5zaXR5OiAwLFxuICAgICAgICB9O1xuXG4gICAgY29uc3QgdW5yZXNvbHZlZE1hcCA9ICh0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLnVucmVzb2x2ZWRMaW5rcyBhcyBSZWNvcmQ8c3RyaW5nLCBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+PiB8IHVuZGVmaW5lZCkgPz8ge307XG5cbiAgICByZXR1cm4ge1xuICAgICAgcGF0aDogZmlsZS5wYXRoLFxuICAgICAgYmFzZW5hbWU6IGZpbGUuYmFzZW5hbWUsXG4gICAgICBtdGltZTogZmlsZS5zdGF0Lm10aW1lLFxuICAgICAgY3RpbWU6IGZpbGUuc3RhdC5jdGltZSxcbiAgICAgIHNpemVCeXRlczogZmlsZS5zdGF0LnNpemUsXG4gICAgICBsaW5rczogY2FjaGU/LmxpbmtzPy5tYXAoKGxpbmspID0+IGxpbmsubGluaykgPz8gW10sXG4gICAgICB1bnJlc29sdmVkTGlua3M6IE9iamVjdC5rZXlzKHVucmVzb2x2ZWRNYXBbZmlsZS5wYXRoXSA/PyB7fSksXG4gICAgICBpbmxpbmtzQ291bnQ6IGluZGV4LmlubGlua3NbZmlsZS5wYXRoXSA/PyAwLFxuICAgICAgb3V0bGlua3NDb3VudDogaW5kZXgub3V0bGlua3NbZmlsZS5wYXRoXSA/PyAwLFxuICAgICAgaGVhZGluZ3M6XG4gICAgICAgIGNhY2hlPy5oZWFkaW5ncz8ubWFwKChpdGVtKSA9PiAoe1xuICAgICAgICAgIGxldmVsOiBpdGVtLmxldmVsLFxuICAgICAgICAgIHRleHQ6IGl0ZW0uaGVhZGluZyxcbiAgICAgICAgfSkpID8/IFtdLFxuICAgICAgdGFnczogY2FjaGU/LnRhZ3M/Lm1hcCgodGFnKSA9PiB0YWcudGFnLnJlcGxhY2UoL14jLywgXCJcIikpID8/IFtdLFxuICAgICAgZnJvbnRtYXR0ZXIsXG4gICAgICBoYXNTdW1tYXJ5OiBzdHJ1Y3R1cmUuaGFzU3VtbWFyeSB8fCBCb29sZWFuKGZyb250bWF0dGVyLnN1bW1hcnkpLFxuICAgICAgcGFyYWdyYXBoQ291bnQ6IHN0cnVjdHVyZS5wYXJhZ3JhcGhDb3VudCxcbiAgICAgIHdvcmRDb3VudDogc3RydWN0dXJlLndvcmRDb3VudCxcbiAgICAgIGxpbmVDb3VudDogc3RydWN0dXJlLmxpbmVDb3VudCxcbiAgICAgIHJhd0NvbnRlbnQsXG4gICAgICBub3RlVHlwZTpcbiAgICAgICAgdHlwZW9mIGZyb250bWF0dGVyLnR5cGUgPT09IFwic3RyaW5nXCJcbiAgICAgICAgICA/IGZyb250bWF0dGVyLnR5cGVcbiAgICAgICAgICA6IHR5cGVvZiBmcm9udG1hdHRlci5ub3RlX3R5cGUgPT09IFwic3RyaW5nXCJcbiAgICAgICAgICAgID8gZnJvbnRtYXR0ZXIubm90ZV90eXBlXG4gICAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgIGN1c3RvbVJldmlld0RhdGU6IHBhcnNlRGF0ZUxpa2UoZnJvbnRtYXR0ZXJbcmV2aWV3RmllbGRdKSxcbiAgICB9O1xuICB9XG59XHJcbiIsICJcdUZFRkZpbXBvcnQgdHlwZSB7IE5vdGVUeXBlUG9saWN5IH0gZnJvbSBcIi4uL3R5cGVzL3NldHRpbmdzXCI7XG5cbmV4cG9ydCBjbGFzcyBGcm9udG1hdHRlclBvbGljeU1hdGNoZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHBvbGljaWVzOiBOb3RlVHlwZVBvbGljeVtdKSB7fVxuXG4gIHJlc29sdmVQb2xpY3kobm90ZVR5cGU/OiBzdHJpbmcpOiBOb3RlVHlwZVBvbGljeSB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKCFub3RlVHlwZSkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5wb2xpY2llcy5maW5kKFxuICAgICAgKHBvbGljeSkgPT4gcG9saWN5Lm5vdGVUeXBlLnRvTG93ZXJDYXNlKCkgPT09IG5vdGVUeXBlLnRvTG93ZXJDYXNlKCksXG4gICAgKTtcbiAgfVxuXG4gIG1pc3NpbmdGaWVsZHMoZnJvbnRtYXR0ZXI6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LCBub3RlVHlwZT86IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBwb2xpY3kgPSB0aGlzLnJlc29sdmVQb2xpY3kobm90ZVR5cGUpO1xuICAgIGlmICghcG9saWN5KSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgcmV0dXJuIHBvbGljeS5yZXF1aXJlZEZyb250bWF0dGVyLmZpbHRlcigoZmllbGQpID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gZnJvbnRtYXR0ZXJbZmllbGRdO1xuICAgICAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlLnRyaW0oKS5sZW5ndGggPT09IDA7XG4gICAgICB9XG5cbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gdmFsdWUubGVuZ3RoID09PSAwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG4gIH1cbn1cclxuIiwgIlx1RkVGRmltcG9ydCB0eXBlIHsgQXVkaXRJc3N1ZSwgQXVkaXRSdWxlLCBBdWRpdFJ1bGVDb250ZXh0IH0gZnJvbSBcIi4uL3R5cGVzL2F1ZGl0XCI7XG5pbXBvcnQgdHlwZSB7IE5vdGVTbmFwc2hvdCB9IGZyb20gXCIuLi90eXBlcy9zbmFwc2hvdFwiO1xuaW1wb3J0IHsgRnJvbnRtYXR0ZXJQb2xpY3lNYXRjaGVyIH0gZnJvbSBcIi4uL2FuYWx5emVycy9Gcm9udG1hdHRlclBvbGljeU1hdGNoZXJcIjtcbmltcG9ydCB7IGRpZmZEYXlzIH0gZnJvbSBcIi4uL3V0aWxzL3RpbWVcIjtcblxuZXhwb3J0IGNsYXNzIE5vdGVBZ2VSdWxlIGltcGxlbWVudHMgQXVkaXRSdWxlIHtcbiAgcmVhZG9ubHkgaWQgPSBcIm5vdGUtYWdlXCIgYXMgY29uc3Q7XG4gIHJlYWRvbmx5IG5hbWUgPSBcIlN0YWxlIG5vdGVcIjtcbiAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSBcIkRldGVjdHMgbm90ZXMgdGhhdCBoYXZlIG5vdCBiZWVuIHJldmlld2VkIHJlY2VudGx5LlwiO1xuXG4gIHJ1bihzbmFwc2hvdDogTm90ZVNuYXBzaG90LCBjdHg6IEF1ZGl0UnVsZUNvbnRleHQpOiBBdWRpdElzc3VlW10ge1xuICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgRnJvbnRtYXR0ZXJQb2xpY3lNYXRjaGVyKGN0eC5zZXR0aW5ncy5ub3RlVHlwZVBvbGljaWVzKTtcbiAgICBjb25zdCBwb2xpY3kgPSBtYXRjaGVyLnJlc29sdmVQb2xpY3koc25hcHNob3Qubm90ZVR5cGUpO1xuICAgIGNvbnN0IHN0YWxlQWZ0ZXJEYXlzID0gcG9saWN5Py5zdGFsZUFmdGVyRGF5cyA/PyA0NTtcblxuICAgIGNvbnN0IHJlZmVyZW5jZVRpbWVzdGFtcCA9IHNuYXBzaG90LmN1c3RvbVJldmlld0RhdGUgPz8gc25hcHNob3QubXRpbWU7XG4gICAgY29uc3QgYWdlRGF5cyA9IGRpZmZEYXlzKHJlZmVyZW5jZVRpbWVzdGFtcCwgY3R4Lm5vdyk7XG5cbiAgICBpZiAoYWdlRGF5cyA8PSBzdGFsZUFmdGVyRGF5cykge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHNldmVyaXR5ID0gYWdlRGF5cyA+IHN0YWxlQWZ0ZXJEYXlzICogMiA/IFwiZXJyb3JcIiA6IFwid2FybmluZ1wiO1xuXG4gICAgcmV0dXJuIFtcbiAgICAgIHtcbiAgICAgICAgcnVsZUlkOiB0aGlzLmlkLFxuICAgICAgICBzZXZlcml0eSxcbiAgICAgICAgY2F0ZWdvcnk6IFwiZnJlc2huZXNzXCIsXG4gICAgICAgIGZpbGVQYXRoOiBzbmFwc2hvdC5wYXRoLFxuICAgICAgICB0aXRsZTogXCJOb3RhIHNlbSByZXZpc1x1MDBFM28gcmVjZW50ZVwiLFxuICAgICAgICBtZXNzYWdlOiBgQSBub3RhIGVzdFx1MDBFMSBoXHUwMEUxICR7YWdlRGF5c30gZGlhcyBzZW0gcmV2aXNcdTAwRTNvLiBMaW1pdGUgY29uZmlndXJhZG86ICR7c3RhbGVBZnRlckRheXN9IGRpYXMuYCxcbiAgICAgICAgc2NvcmVJbXBhY3Q6IHNldmVyaXR5ID09PSBcImVycm9yXCIgPyAzIDogMixcbiAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgICBhZ2VEYXlzLFxuICAgICAgICAgIHN0YWxlQWZ0ZXJEYXlzLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdO1xuICB9XG59IiwgIlx1RkVGRmV4cG9ydCBpbnRlcmZhY2UgTGlua1N0cmVuZ3RoUmVwb3J0IHtcbiAgd2Vha0xpbmtDb3VudDogbnVtYmVyO1xuICBpc29sYXRlZExpbmtMaW5lczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBjbGFzcyBMaW5rU3RyZW5ndGhBbmFseXplciB7XG4gIGFuYWx5emUobWFya2Rvd246IHN0cmluZyk6IExpbmtTdHJlbmd0aFJlcG9ydCB7XG4gICAgY29uc3QgbGluZXMgPSBtYXJrZG93bi5zcGxpdCgvXFxyP1xcbi8pO1xuXG4gICAgY29uc3QgaXNvbGF0ZWQgPSBsaW5lcy5maWx0ZXIoKGxpbmUpID0+IHtcbiAgICAgIGNvbnN0IHRyaW1tZWQgPSBsaW5lLnRyaW0oKTtcbiAgICAgIGlmICghdHJpbW1lZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNvbnRhaW5zTGluayA9IC9cXFtcXFsuKj9cXF1cXF0vLnRlc3QodHJpbW1lZCkgfHwgL1xcWy4qP1xcXVxcKC4qP1xcKS8udGVzdCh0cmltbWVkKTtcbiAgICAgIGlmICghY29udGFpbnNMaW5rKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgd2l0aG91dExpbmtzID0gdHJpbW1lZFxuICAgICAgICAucmVwbGFjZSgvXFxbXFxbLio/XFxdXFxdL2csIFwiXCIpXG4gICAgICAgIC5yZXBsYWNlKC9cXFsuKj9cXF1cXCguKj9cXCkvZywgXCJcIilcbiAgICAgICAgLnJlcGxhY2UoL15bLSpdXFxzKi8sIFwiXCIpXG4gICAgICAgIC50cmltKCk7XG5cbiAgICAgIHJldHVybiB3aXRob3V0TGlua3MubGVuZ3RoIDwgMTA7XG4gICAgfSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgd2Vha0xpbmtDb3VudDogaXNvbGF0ZWQubGVuZ3RoLFxuICAgICAgaXNvbGF0ZWRMaW5rTGluZXM6IGlzb2xhdGVkLnNsaWNlKDAsIDUpLFxuICAgIH07XG4gIH1cbn1cclxuIiwgIlx1RkVGRmltcG9ydCB0eXBlIHsgQXVkaXRJc3N1ZSwgQXVkaXRSdWxlIH0gZnJvbSBcIi4uL3R5cGVzL2F1ZGl0XCI7XG5pbXBvcnQgdHlwZSB7IE5vdGVTbmFwc2hvdCB9IGZyb20gXCIuLi90eXBlcy9zbmFwc2hvdFwiO1xuaW1wb3J0IHsgTGlua1N0cmVuZ3RoQW5hbHl6ZXIgfSBmcm9tIFwiLi4vYW5hbHl6ZXJzL0xpbmtTdHJlbmd0aEFuYWx5emVyXCI7XG5cbmV4cG9ydCBjbGFzcyBCcm9rZW5MaW5rc1J1bGUgaW1wbGVtZW50cyBBdWRpdFJ1bGUge1xuICByZWFkb25seSBpZCA9IFwiYnJva2VuLWxpbmtzXCIgYXMgY29uc3Q7XG4gIHJlYWRvbmx5IG5hbWUgPSBcIkJyb2tlbiBvciB3ZWFrIGxpbmtzXCI7XG4gIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gXCJEZXRlY3RzIHVucmVzb2x2ZWQgbGlua3MgYW5kIHdlYWsgbGluayBjb250ZXh0LlwiO1xuXG4gIHJ1bihzbmFwc2hvdDogTm90ZVNuYXBzaG90KTogQXVkaXRJc3N1ZVtdIHtcbiAgICBjb25zdCBpc3N1ZXM6IEF1ZGl0SXNzdWVbXSA9IFtdO1xuXG4gICAgaWYgKHNuYXBzaG90LnVucmVzb2x2ZWRMaW5rcy5sZW5ndGggPiAwKSB7XG4gICAgICBpc3N1ZXMucHVzaCh7XG4gICAgICAgIHJ1bGVJZDogdGhpcy5pZCxcbiAgICAgICAgc2V2ZXJpdHk6IFwiZXJyb3JcIixcbiAgICAgICAgY2F0ZWdvcnk6IFwibGlua3NcIixcbiAgICAgICAgZmlsZVBhdGg6IHNuYXBzaG90LnBhdGgsXG4gICAgICAgIHRpdGxlOiBcIkxpbmtzIHF1ZWJyYWRvcyBlbmNvbnRyYWRvc1wiLFxuICAgICAgICBtZXNzYWdlOiBgQSBub3RhIHBvc3N1aSAke3NuYXBzaG90LnVucmVzb2x2ZWRMaW5rcy5sZW5ndGh9IGxpbmsocykgc2VtIHJlc29sdVx1MDBFN1x1MDBFM28uYCxcbiAgICAgICAgZXZpZGVuY2U6IHNuYXBzaG90LnVucmVzb2x2ZWRMaW5rcy5zbGljZSgwLCA1KSxcbiAgICAgICAgc2NvcmVJbXBhY3Q6IDQsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoc25hcHNob3QucmF3Q29udGVudCkge1xuICAgICAgY29uc3Qgc3RyZW5ndGggPSBuZXcgTGlua1N0cmVuZ3RoQW5hbHl6ZXIoKS5hbmFseXplKHNuYXBzaG90LnJhd0NvbnRlbnQpO1xuICAgICAgaWYgKHN0cmVuZ3RoLndlYWtMaW5rQ291bnQgPiAwKSB7XG4gICAgICAgIGlzc3Vlcy5wdXNoKHtcbiAgICAgICAgICBydWxlSWQ6IHRoaXMuaWQsXG4gICAgICAgICAgc2V2ZXJpdHk6IFwid2FybmluZ1wiLFxuICAgICAgICAgIGNhdGVnb3J5OiBcImxpbmtzXCIsXG4gICAgICAgICAgZmlsZVBhdGg6IHNuYXBzaG90LnBhdGgsXG4gICAgICAgICAgdGl0bGU6IFwiTGlua3MgZnJhY29zIG91IGlzb2xhZG9zXCIsXG4gICAgICAgICAgbWVzc2FnZTogYEZvcmFtIGVuY29udHJhZGFzICR7c3RyZW5ndGgud2Vha0xpbmtDb3VudH0gbGluaGEocykgY29tIGxpbmtzIHNlbSBjb250ZXh0byBzdWZpY2llbnRlLmAsXG4gICAgICAgICAgZXZpZGVuY2U6IHN0cmVuZ3RoLmlzb2xhdGVkTGlua0xpbmVzLFxuICAgICAgICAgIHNjb3JlSW1wYWN0OiAyLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gaXNzdWVzO1xuICB9XG59IiwgIlx1RkVGRmltcG9ydCB0eXBlIHsgQXVkaXRJc3N1ZSwgQXVkaXRSdWxlIH0gZnJvbSBcIi4uL3R5cGVzL2F1ZGl0XCI7XG5pbXBvcnQgdHlwZSB7IE5vdGVTbmFwc2hvdCB9IGZyb20gXCIuLi90eXBlcy9zbmFwc2hvdFwiO1xuXG5leHBvcnQgY2xhc3MgT3JwaGFuTm90ZVJ1bGUgaW1wbGVtZW50cyBBdWRpdFJ1bGUge1xuICByZWFkb25seSBpZCA9IFwib3JwaGFuLW5vdGVcIiBhcyBjb25zdDtcbiAgcmVhZG9ubHkgbmFtZSA9IFwiT3JwaGFuIG5vdGVcIjtcbiAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSBcIkRldGVjdHMgbm90ZXMgd2l0aG91dCBpbmxpbmtzIGFuZCBvdXRsaW5rcy5cIjtcblxuICBydW4oc25hcHNob3Q6IE5vdGVTbmFwc2hvdCk6IEF1ZGl0SXNzdWVbXSB7XG4gICAgaWYgKHNuYXBzaG90LmlubGlua3NDb3VudCA+IDAgfHwgc25hcHNob3Qub3V0bGlua3NDb3VudCA+IDApIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICByZXR1cm4gW1xuICAgICAge1xuICAgICAgICBydWxlSWQ6IHRoaXMuaWQsXG4gICAgICAgIHNldmVyaXR5OiBcIndhcm5pbmdcIixcbiAgICAgICAgY2F0ZWdvcnk6IFwibGlua3NcIixcbiAgICAgICAgZmlsZVBhdGg6IHNuYXBzaG90LnBhdGgsXG4gICAgICAgIHRpdGxlOiBcIk5vdGEgXHUwMEYzcmZcdTAwRTNcIixcbiAgICAgICAgbWVzc2FnZTogXCJBIG5vdGEgblx1MDBFM28gcG9zc3VpIGlubGlua3MgbmVtIG91dGxpbmtzLlwiLFxuICAgICAgICBzY29yZUltcGFjdDogMixcbiAgICAgIH0sXG4gICAgXTtcbiAgfVxufSIsICJcdUZFRkZpbXBvcnQgdHlwZSB7IEF1ZGl0SXNzdWUsIEF1ZGl0UnVsZSwgQXVkaXRSdWxlQ29udGV4dCB9IGZyb20gXCIuLi90eXBlcy9hdWRpdFwiO1xuaW1wb3J0IHR5cGUgeyBOb3RlU25hcHNob3QgfSBmcm9tIFwiLi4vdHlwZXMvc25hcHNob3RcIjtcbmltcG9ydCB7IEZyb250bWF0dGVyUG9saWN5TWF0Y2hlciB9IGZyb20gXCIuLi9hbmFseXplcnMvRnJvbnRtYXR0ZXJQb2xpY3lNYXRjaGVyXCI7XG5cbmV4cG9ydCBjbGFzcyBSZXF1aXJlZEZyb250bWF0dGVyUnVsZSBpbXBsZW1lbnRzIEF1ZGl0UnVsZSB7XG4gIHJlYWRvbmx5IGlkID0gXCJyZXF1aXJlZC1mcm9udG1hdHRlclwiIGFzIGNvbnN0O1xuICByZWFkb25seSBuYW1lID0gXCJSZXF1aXJlZCBmcm9udG1hdHRlclwiO1xuICByZWFkb25seSBkZXNjcmlwdGlvbiA9IFwiQ2hlY2tzIG1hbmRhdG9yeSBmcm9udG1hdHRlciBiYXNlZCBvbiBub3RlIHR5cGUuXCI7XG5cbiAgcnVuKHNuYXBzaG90OiBOb3RlU25hcHNob3QsIGN0eDogQXVkaXRSdWxlQ29udGV4dCk6IEF1ZGl0SXNzdWVbXSB7XG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBGcm9udG1hdHRlclBvbGljeU1hdGNoZXIoY3R4LnNldHRpbmdzLm5vdGVUeXBlUG9saWNpZXMpO1xuICAgIGNvbnN0IG1pc3NpbmcgPSBtYXRjaGVyLm1pc3NpbmdGaWVsZHMoc25hcHNob3QuZnJvbnRtYXR0ZXIsIHNuYXBzaG90Lm5vdGVUeXBlKTtcblxuICAgIGlmIChtaXNzaW5nLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIHJldHVybiBbXG4gICAgICB7XG4gICAgICAgIHJ1bGVJZDogdGhpcy5pZCxcbiAgICAgICAgc2V2ZXJpdHk6IFwid2FybmluZ1wiLFxuICAgICAgICBjYXRlZ29yeTogXCJtZXRhZGF0YVwiLFxuICAgICAgICBmaWxlUGF0aDogc25hcHNob3QucGF0aCxcbiAgICAgICAgdGl0bGU6IFwiRnJvbnRtYXR0ZXIgb2JyaWdhdFx1MDBGM3JpbyBhdXNlbnRlXCIsXG4gICAgICAgIG1lc3NhZ2U6IGBDYW1wb3MgYXVzZW50ZXMgcGFyYSBvIHRpcG8gXCIke3NuYXBzaG90Lm5vdGVUeXBlID8/IFwiZGVzY29uaGVjaWRvXCJ9XCI6ICR7bWlzc2luZy5qb2luKFwiLCBcIil9LmAsXG4gICAgICAgIGV2aWRlbmNlOiBtaXNzaW5nLFxuICAgICAgICBzY29yZUltcGFjdDogMixcbiAgICAgICAgYXV0b2ZpeGFibGU6IGZhbHNlLFxuICAgICAgfSxcbiAgICBdO1xuICB9XG59IiwgIlx1RkVGRmltcG9ydCB0eXBlIHsgQXVkaXRJc3N1ZSwgQXVkaXRSdWxlLCBBdWRpdFJ1bGVDb250ZXh0IH0gZnJvbSBcIi4uL3R5cGVzL2F1ZGl0XCI7XG5pbXBvcnQgdHlwZSB7IE5vdGVTbmFwc2hvdCB9IGZyb20gXCIuLi90eXBlcy9zbmFwc2hvdFwiO1xuXG5leHBvcnQgY2xhc3MgTGFyZ2VVbnN0cnVjdHVyZWROb3RlUnVsZSBpbXBsZW1lbnRzIEF1ZGl0UnVsZSB7XG4gIHJlYWRvbmx5IGlkID0gXCJsYXJnZS11bnN0cnVjdHVyZWQtbm90ZVwiIGFzIGNvbnN0O1xuICByZWFkb25seSBuYW1lID0gXCJMYXJnZSB1bnN0cnVjdHVyZWQgbm90ZVwiO1xuICByZWFkb25seSBkZXNjcmlwdGlvbiA9IFwiRGV0ZWN0cyBsb25nIG5vdGVzIHdpdGggcG9vciBoZWFkaW5nIHN0cnVjdHVyZS5cIjtcbiAgcmVhZG9ubHkgcmVxdWlyZXNDb250ZW50ID0gdHJ1ZTtcblxuICBydW4oc25hcHNob3Q6IE5vdGVTbmFwc2hvdCwgY3R4OiBBdWRpdFJ1bGVDb250ZXh0KTogQXVkaXRJc3N1ZVtdIHtcbiAgICBpZiAoIXNuYXBzaG90LnJhd0NvbnRlbnQpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBpZiAoc25hcHNob3Qud29yZENvdW50IDwgY3R4LnNldHRpbmdzLmxhcmdlTm90ZVdvcmRUaHJlc2hvbGQpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBpZiAoc25hcHNob3QuaGVhZGluZ3MubGVuZ3RoID49IDIpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICByZXR1cm4gW1xuICAgICAge1xuICAgICAgICBydWxlSWQ6IHRoaXMuaWQsXG4gICAgICAgIHNldmVyaXR5OiBcIndhcm5pbmdcIixcbiAgICAgICAgY2F0ZWdvcnk6IFwic3RydWN0dXJlXCIsXG4gICAgICAgIGZpbGVQYXRoOiBzbmFwc2hvdC5wYXRoLFxuICAgICAgICB0aXRsZTogXCJOb3RhIGdyYW5kZSBzZW0gZXN0cnV0dXJhIHN1ZmljaWVudGVcIixcbiAgICAgICAgbWVzc2FnZTogYEEgbm90YSBwb3NzdWkgJHtzbmFwc2hvdC53b3JkQ291bnR9IHBhbGF2cmFzIGUgYXBlbmFzICR7c25hcHNob3QuaGVhZGluZ3MubGVuZ3RofSBoZWFkaW5nKHMpLmAsXG4gICAgICAgIHNjb3JlSW1wYWN0OiAzLFxuICAgICAgfSxcbiAgICBdO1xuICB9XG59IiwgIlx1RkVGRmltcG9ydCB0eXBlIHsgQXVkaXRJc3N1ZSwgQXVkaXRSdWxlLCBBdWRpdFJ1bGVDb250ZXh0IH0gZnJvbSBcIi4uL3R5cGVzL2F1ZGl0XCI7XG5pbXBvcnQgdHlwZSB7IE5vdGVTbmFwc2hvdCB9IGZyb20gXCIuLi90eXBlcy9zbmFwc2hvdFwiO1xuXG5leHBvcnQgY2xhc3MgRHVtcFBhZ2VSdWxlIGltcGxlbWVudHMgQXVkaXRSdWxlIHtcbiAgcmVhZG9ubHkgaWQgPSBcImR1bXAtcGFnZVwiIGFzIGNvbnN0O1xuICByZWFkb25seSBuYW1lID0gXCJEdW1wIHBhZ2VcIjtcbiAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSBcIkRldGVjdHMgbm90ZXMgdGhhdCBsb29rIGxpa2UgdW5zdHJ1Y3R1cmVkIGR1bXBpbmcgZ3JvdW5kcy5cIjtcbiAgcmVhZG9ubHkgcmVxdWlyZXNDb250ZW50ID0gdHJ1ZTtcblxuICBydW4oc25hcHNob3Q6IE5vdGVTbmFwc2hvdCwgY3R4OiBBdWRpdFJ1bGVDb250ZXh0KTogQXVkaXRJc3N1ZVtdIHtcbiAgICBpZiAoIXNuYXBzaG90LnJhd0NvbnRlbnQpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCB0b29NYW55TGlua3MgPSBzbmFwc2hvdC5saW5rcy5sZW5ndGggPj0gY3R4LnNldHRpbmdzLmR1bXBQYWdlTGlua1RocmVzaG9sZDtcbiAgICBjb25zdCB3ZWFrUGFyYWdyYXBoRGVuc2l0eSA9XG4gICAgICBzbmFwc2hvdC53b3JkQ291bnQgPiAwXG4gICAgICAgID8gc25hcHNob3QucGFyYWdyYXBoQ291bnQgLyBzbmFwc2hvdC53b3JkQ291bnQgPCBjdHguc2V0dGluZ3MuZHVtcFBhZ2VQYXJhZ3JhcGhEZW5zaXR5TWluXG4gICAgICAgIDogZmFsc2U7XG5cbiAgICBpZiAoIXRvb01hbnlMaW5rcyAmJiAhd2Vha1BhcmFncmFwaERlbnNpdHkpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICByZXR1cm4gW1xuICAgICAge1xuICAgICAgICBydWxlSWQ6IHRoaXMuaWQsXG4gICAgICAgIHNldmVyaXR5OiBcIndhcm5pbmdcIixcbiAgICAgICAgY2F0ZWdvcnk6IFwic3RydWN0dXJlXCIsXG4gICAgICAgIGZpbGVQYXRoOiBzbmFwc2hvdC5wYXRoLFxuICAgICAgICB0aXRsZTogXCJQXHUwMEUxZ2luYSBjb20gY2FyYWN0ZXJcdTAwRURzdGljYSBkZSBkZXBcdTAwRjNzaXRvXCIsXG4gICAgICAgIG1lc3NhZ2U6IGBBIG5vdGEgdGVtICR7c25hcHNob3QubGlua3MubGVuZ3RofSBsaW5rcyBlICR7c25hcHNob3QucGFyYWdyYXBoQ291bnR9IHBhclx1MDBFMWdyYWZvKHMpLCBzdWdlcmluZG8gYWNcdTAwRkFtdWxvIHNlbSBjdXJhZG9yaWEuYCxcbiAgICAgICAgc2NvcmVJbXBhY3Q6IDMsXG4gICAgICB9LFxuICAgIF07XG4gIH1cbn0iLCAiXHVGRUZGaW1wb3J0IHR5cGUgeyBBdWRpdElzc3VlLCBBdWRpdFJ1bGUsIEF1ZGl0UnVsZUNvbnRleHQgfSBmcm9tIFwiLi4vdHlwZXMvYXVkaXRcIjtcbmltcG9ydCB0eXBlIHsgTm90ZVNuYXBzaG90IH0gZnJvbSBcIi4uL3R5cGVzL3NuYXBzaG90XCI7XG5pbXBvcnQgeyBGcm9udG1hdHRlclBvbGljeU1hdGNoZXIgfSBmcm9tIFwiLi4vYW5hbHl6ZXJzL0Zyb250bWF0dGVyUG9saWN5TWF0Y2hlclwiO1xuXG5leHBvcnQgY2xhc3MgTWlzc2luZ1N1bW1hcnlSdWxlIGltcGxlbWVudHMgQXVkaXRSdWxlIHtcbiAgcmVhZG9ubHkgaWQgPSBcIm1pc3Npbmctc3VtbWFyeVwiIGFzIGNvbnN0O1xuICByZWFkb25seSBuYW1lID0gXCJNaXNzaW5nIHN1bW1hcnlcIjtcbiAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSBcIkNoZWNrcyBpZiBub3RlcyB0aGF0IHJlcXVpcmUgc3VtbWFyeSBhY3R1YWxseSBoYXZlIG9uZS5cIjtcbiAgcmVhZG9ubHkgcmVxdWlyZXNDb250ZW50ID0gdHJ1ZTtcblxuICBydW4oc25hcHNob3Q6IE5vdGVTbmFwc2hvdCwgY3R4OiBBdWRpdFJ1bGVDb250ZXh0KTogQXVkaXRJc3N1ZVtdIHtcbiAgICBjb25zdCBtYXRjaGVyID0gbmV3IEZyb250bWF0dGVyUG9saWN5TWF0Y2hlcihjdHguc2V0dGluZ3Mubm90ZVR5cGVQb2xpY2llcyk7XG4gICAgY29uc3QgcG9saWN5ID0gbWF0Y2hlci5yZXNvbHZlUG9saWN5KHNuYXBzaG90Lm5vdGVUeXBlKTtcblxuICAgIGlmICghcG9saWN5Py5zdW1tYXJ5UmVxdWlyZWQpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBpZiAoc25hcHNob3QuaGFzU3VtbWFyeSkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIHJldHVybiBbXG4gICAgICB7XG4gICAgICAgIHJ1bGVJZDogdGhpcy5pZCxcbiAgICAgICAgc2V2ZXJpdHk6IFwid2FybmluZ1wiLFxuICAgICAgICBjYXRlZ29yeTogXCJrbm93bGVkZ2UtcXVhbGl0eVwiLFxuICAgICAgICBmaWxlUGF0aDogc25hcHNob3QucGF0aCxcbiAgICAgICAgdGl0bGU6IFwiUmVzdW1vIGF1c2VudGVcIixcbiAgICAgICAgbWVzc2FnZTogYE5vdGFzIGRvIHRpcG8gXCIke3NuYXBzaG90Lm5vdGVUeXBlfVwiIGV4aWdlbSByZXN1bW8sIG1hcyBuZW5odW0gZm9pIGRldGVjdGFkby5gLFxuICAgICAgICBzY29yZUltcGFjdDogMixcbiAgICAgIH0sXG4gICAgXTtcbiAgfVxufSIsICJcdUZFRkZleHBvcnQgaW50ZXJmYWNlIENsYWltRGV0ZWN0aW9uUmVwb3J0IHtcbiAgdW5zdXBwb3J0ZWRDbGFpbUNvdW50OiBudW1iZXI7XG4gIHNhbXBsZXM6IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgY2xhc3MgQ2xhaW1EZXRlY3RvciB7XG4gIGFuYWx5emUobWFya2Rvd246IHN0cmluZyk6IENsYWltRGV0ZWN0aW9uUmVwb3J0IHtcbiAgICBjb25zdCBub3JtYWxpemVkID0gbWFya2Rvd24ucmVwbGFjZSgvXFxyP1xcbi9nLCBcIiBcIik7XG4gICAgY29uc3Qgc2VudGVuY2VzID0gbm9ybWFsaXplZFxuICAgICAgLnNwbGl0KC8oPzw9Wy4hP10pXFxzKy8pXG4gICAgICAubWFwKChzZW50ZW5jZSkgPT4gc2VudGVuY2UudHJpbSgpKVxuICAgICAgLmZpbHRlcihCb29sZWFuKTtcblxuICAgIGNvbnN0IHVuc3VwcG9ydGVkID0gc2VudGVuY2VzLmZpbHRlcigoc2VudGVuY2UpID0+IHtcbiAgICAgIGlmIChzZW50ZW5jZS5sZW5ndGggPCA2MCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGFzc2VydGl2ZVBhdHRlcm4gPVxuICAgICAgICAvXFxiKFx1MDBDM1x1MDBBOXxzXHUwMEMzXHUwMEEzb3xkZXZlfGluZGljYXxkZW1vbnN0cmF8bW9zdHJhfHByb3ZhfHNob3dzfGRlbW9uc3RyYXRlc3xpbmRpY2F0ZXN8bXVzdHxzaG91bGQpXFxiL2k7XG4gICAgICBjb25zdCBoYXNDaXRhdGlvbiA9XG4gICAgICAgIC9cXFtcXFsuKj9cXF1cXF0vLnRlc3Qoc2VudGVuY2UpIHx8XG4gICAgICAgIC9cXFsuKj9cXF1cXCguKj9cXCkvLnRlc3Qoc2VudGVuY2UpIHx8XG4gICAgICAgIC9odHRwcz86XFwvXFwvL2kudGVzdChzZW50ZW5jZSk7XG5cbiAgICAgIHJldHVybiBhc3NlcnRpdmVQYXR0ZXJuLnRlc3Qoc2VudGVuY2UpICYmICFoYXNDaXRhdGlvbjtcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICB1bnN1cHBvcnRlZENsYWltQ291bnQ6IHVuc3VwcG9ydGVkLmxlbmd0aCxcbiAgICAgIHNhbXBsZXM6IHVuc3VwcG9ydGVkLnNsaWNlKDAsIDMpLFxuICAgIH07XG4gIH1cbn1cclxuIiwgIlx1RkVGRmltcG9ydCB0eXBlIHsgQXVkaXRJc3N1ZSwgQXVkaXRSdWxlIH0gZnJvbSBcIi4uL3R5cGVzL2F1ZGl0XCI7XG5pbXBvcnQgdHlwZSB7IE5vdGVTbmFwc2hvdCB9IGZyb20gXCIuLi90eXBlcy9zbmFwc2hvdFwiO1xuaW1wb3J0IHsgQ2xhaW1EZXRlY3RvciB9IGZyb20gXCIuLi9hbmFseXplcnMvQ2xhaW1EZXRlY3RvclwiO1xuXG5leHBvcnQgY2xhc3MgVW5zdXBwb3J0ZWRDbGFpbXNSdWxlIGltcGxlbWVudHMgQXVkaXRSdWxlIHtcbiAgcmVhZG9ubHkgaWQgPSBcInVuc3VwcG9ydGVkLWNsYWltc1wiIGFzIGNvbnN0O1xuICByZWFkb25seSBuYW1lID0gXCJVbnN1cHBvcnRlZCBjbGFpbXNcIjtcbiAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSBcIkZsYWdzIGFzc2VydGl2ZSBjbGFpbXMgd2l0aG91dCBuZWFyYnkgcmVmZXJlbmNlcy5cIjtcbiAgcmVhZG9ubHkgcmVxdWlyZXNDb250ZW50ID0gdHJ1ZTtcblxuICBydW4oc25hcHNob3Q6IE5vdGVTbmFwc2hvdCk6IEF1ZGl0SXNzdWVbXSB7XG4gICAgaWYgKCFzbmFwc2hvdC5yYXdDb250ZW50KSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgcmVwb3J0ID0gbmV3IENsYWltRGV0ZWN0b3IoKS5hbmFseXplKHNuYXBzaG90LnJhd0NvbnRlbnQpO1xuICAgIGlmIChyZXBvcnQudW5zdXBwb3J0ZWRDbGFpbUNvdW50ID09PSAwKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgcmV0dXJuIFtcbiAgICAgIHtcbiAgICAgICAgcnVsZUlkOiB0aGlzLmlkLFxuICAgICAgICBzZXZlcml0eTogXCJ3YXJuaW5nXCIsXG4gICAgICAgIGNhdGVnb3J5OiBcImtub3dsZWRnZS1xdWFsaXR5XCIsXG4gICAgICAgIGZpbGVQYXRoOiBzbmFwc2hvdC5wYXRoLFxuICAgICAgICB0aXRsZTogXCJDbGFpbXMgc2VtIHN1cG9ydGUgZGV0ZWN0YWRvc1wiLFxuICAgICAgICBtZXNzYWdlOiBgRm9yYW0gZW5jb250cmFkYXMgJHtyZXBvcnQudW5zdXBwb3J0ZWRDbGFpbUNvdW50fSBhZmlybWFcdTAwRTdcdTAwRjVlcyBwb3RlbmNpYWxtZW50ZSBzZW0gZm9udGUuYCxcbiAgICAgICAgZXZpZGVuY2U6IHJlcG9ydC5zYW1wbGVzLFxuICAgICAgICBzY29yZUltcGFjdDogMyxcbiAgICAgIH0sXG4gICAgXTtcbiAgfVxufSIsICJcdUZFRkZpbXBvcnQgdHlwZSB7IEF1ZGl0UnVsZSB9IGZyb20gXCIuLi90eXBlcy9hdWRpdFwiO1xuaW1wb3J0IHR5cGUgeyBWYXVsdEhlYWx0aFNldHRpbmdzIH0gZnJvbSBcIi4uL3R5cGVzL3NldHRpbmdzXCI7XG5pbXBvcnQgeyBOb3RlQWdlUnVsZSB9IGZyb20gXCIuLi9ydWxlcy9Ob3RlQWdlUnVsZVwiO1xuaW1wb3J0IHsgQnJva2VuTGlua3NSdWxlIH0gZnJvbSBcIi4uL3J1bGVzL0Jyb2tlbkxpbmtzUnVsZVwiO1xuaW1wb3J0IHsgT3JwaGFuTm90ZVJ1bGUgfSBmcm9tIFwiLi4vcnVsZXMvT3JwaGFuTm90ZVJ1bGVcIjtcbmltcG9ydCB7IFJlcXVpcmVkRnJvbnRtYXR0ZXJSdWxlIH0gZnJvbSBcIi4uL3J1bGVzL1JlcXVpcmVkRnJvbnRtYXR0ZXJSdWxlXCI7XG5pbXBvcnQgeyBMYXJnZVVuc3RydWN0dXJlZE5vdGVSdWxlIH0gZnJvbSBcIi4uL3J1bGVzL0xhcmdlVW5zdHJ1Y3R1cmVkTm90ZVJ1bGVcIjtcbmltcG9ydCB7IER1bXBQYWdlUnVsZSB9IGZyb20gXCIuLi9ydWxlcy9EdW1wUGFnZVJ1bGVcIjtcbmltcG9ydCB7IE1pc3NpbmdTdW1tYXJ5UnVsZSB9IGZyb20gXCIuLi9ydWxlcy9NaXNzaW5nU3VtbWFyeVJ1bGVcIjtcbmltcG9ydCB7IFVuc3VwcG9ydGVkQ2xhaW1zUnVsZSB9IGZyb20gXCIuLi9ydWxlcy9VbnN1cHBvcnRlZENsYWltc1J1bGVcIjtcblxuZXhwb3J0IGNsYXNzIFJ1bGVSZWdpc3RyeSB7XG4gIHByaXZhdGUgcmVhZG9ubHkgcnVsZXM6IEF1ZGl0UnVsZVtdID0gW1xuICAgIG5ldyBOb3RlQWdlUnVsZSgpLFxuICAgIG5ldyBCcm9rZW5MaW5rc1J1bGUoKSxcbiAgICBuZXcgT3JwaGFuTm90ZVJ1bGUoKSxcbiAgICBuZXcgUmVxdWlyZWRGcm9udG1hdHRlclJ1bGUoKSxcbiAgICBuZXcgTGFyZ2VVbnN0cnVjdHVyZWROb3RlUnVsZSgpLFxuICAgIG5ldyBEdW1wUGFnZVJ1bGUoKSxcbiAgICBuZXcgTWlzc2luZ1N1bW1hcnlSdWxlKCksXG4gICAgbmV3IFVuc3VwcG9ydGVkQ2xhaW1zUnVsZSgpLFxuICBdO1xuXG4gIGdldFJ1bGVzKHNldHRpbmdzOiBWYXVsdEhlYWx0aFNldHRpbmdzKTogQXVkaXRSdWxlW10ge1xuICAgIHJldHVybiB0aGlzLnJ1bGVzLmZpbHRlcigocnVsZSkgPT4gc2V0dGluZ3MuZW5hYmxlZFJ1bGVzLmluY2x1ZGVzKHJ1bGUuaWQpKTtcbiAgfVxufVxyXG4iLCAiXHVGRUZGaW1wb3J0IHR5cGUgeyBBdWRpdFJ1bGVJZCwgQXVkaXRTZXZlcml0eSB9IGZyb20gXCIuLi90eXBlcy9hdWRpdFwiO1xuXG5leHBvcnQgY29uc3QgUlVMRV9XRUlHSFRTOiBSZWNvcmQ8QXVkaXRSdWxlSWQsIG51bWJlcj4gPSB7XG4gIFwibm90ZS1hZ2VcIjogMS4xLFxuICBcImJyb2tlbi1saW5rc1wiOiAyLjAsXG4gIFwib3JwaGFuLW5vdGVcIjogMS40LFxuICBcInJlcXVpcmVkLWZyb250bWF0dGVyXCI6IDEuMixcbiAgXCJsYXJnZS11bnN0cnVjdHVyZWQtbm90ZVwiOiAxLjUsXG4gIFwiZHVtcC1wYWdlXCI6IDEuOCxcbiAgXCJtaXNzaW5nLXN1bW1hcnlcIjogMS4wLFxuICBcInVuc3VwcG9ydGVkLWNsYWltc1wiOiAyLjIsXG59O1xuXG5leHBvcnQgY29uc3QgU0VWRVJJVFlfTVVMVElQTElFUjogUmVjb3JkPEF1ZGl0U2V2ZXJpdHksIG51bWJlcj4gPSB7XG4gIGluZm86IDAuNSxcbiAgd2FybmluZzogMS4wLFxuICBlcnJvcjogMS43NSxcbiAgY3JpdGljYWw6IDIuNSxcbn07XHJcbiIsICJcdUZFRkZpbXBvcnQgdHlwZSB7IEF1ZGl0SXNzdWUgfSBmcm9tIFwiLi4vdHlwZXMvYXVkaXRcIjtcbmltcG9ydCB0eXBlIHsgSGVhbHRoQ2F0ZWdvcnksIEhlYWx0aFNjb3JlQnJlYWtkb3duIH0gZnJvbSBcIi4uL3R5cGVzL3Njb3JlXCI7XG5pbXBvcnQgeyBSVUxFX1dFSUdIVFMsIFNFVkVSSVRZX01VTFRJUExJRVIgfSBmcm9tIFwiLi9TY29yZVdlaWdodHNcIjtcblxuY29uc3QgQ0FURUdPUklFUzogSGVhbHRoQ2F0ZWdvcnlbXSA9IFtcbiAgXCJmcmVzaG5lc3NcIixcbiAgXCJsaW5rc1wiLFxuICBcInN0cnVjdHVyZVwiLFxuICBcIm1ldGFkYXRhXCIsXG4gIFwia25vd2xlZGdlLXF1YWxpdHlcIixcbl07XG5cbmV4cG9ydCBjbGFzcyBIZWFsdGhTY29yZVNlcnZpY2Uge1xuICBjYWxjdWxhdGUoaXNzdWVzOiBBdWRpdElzc3VlW10sIGZpbGVzU2Nhbm5lZDogbnVtYmVyKTogSGVhbHRoU2NvcmVCcmVha2Rvd24ge1xuICAgIGNvbnN0IHBlbmFsdGllc0J5Q2F0ZWdvcnk6IFJlY29yZDxIZWFsdGhDYXRlZ29yeSwgbnVtYmVyPiA9IHtcbiAgICAgIGZyZXNobmVzczogMCxcbiAgICAgIGxpbmtzOiAwLFxuICAgICAgc3RydWN0dXJlOiAwLFxuICAgICAgbWV0YWRhdGE6IDAsXG4gICAgICBcImtub3dsZWRnZS1xdWFsaXR5XCI6IDAsXG4gICAgfTtcblxuICAgIGNvbnN0IGlzc3VlQ291bnRCeVNldmVyaXR5ID0ge1xuICAgICAgaW5mbzogMCxcbiAgICAgIHdhcm5pbmc6IDAsXG4gICAgICBlcnJvcjogMCxcbiAgICAgIGNyaXRpY2FsOiAwLFxuICAgIH07XG5cbiAgICBsZXQgdG90YWxQZW5hbHR5ID0gMDtcblxuICAgIGZvciAoY29uc3QgaXNzdWUgb2YgaXNzdWVzKSB7XG4gICAgICBjb25zdCB3ZWlnaHRlZFBlbmFsdHkgPVxuICAgICAgICBpc3N1ZS5zY29yZUltcGFjdCAqXG4gICAgICAgIFJVTEVfV0VJR0hUU1tpc3N1ZS5ydWxlSWRdICpcbiAgICAgICAgU0VWRVJJVFlfTVVMVElQTElFUltpc3N1ZS5zZXZlcml0eV07XG5cbiAgICAgIHBlbmFsdGllc0J5Q2F0ZWdvcnlbaXNzdWUuY2F0ZWdvcnldICs9IHdlaWdodGVkUGVuYWx0eTtcbiAgICAgIGlzc3VlQ291bnRCeVNldmVyaXR5W2lzc3VlLnNldmVyaXR5XSArPSAxO1xuICAgICAgdG90YWxQZW5hbHR5ICs9IHdlaWdodGVkUGVuYWx0eTtcbiAgICB9XG5cbiAgICBjb25zdCBub3JtYWxpemVkUGVuYWx0eSA9IGZpbGVzU2Nhbm5lZCA+IDAgPyAodG90YWxQZW5hbHR5IC8gZmlsZXNTY2FubmVkKSAqIDUgOiB0b3RhbFBlbmFsdHk7XG4gICAgY29uc3QgdG90YWwgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigxMDAsIE1hdGgucm91bmQoMTAwIC0gbm9ybWFsaXplZFBlbmFsdHkpKSk7XG5cbiAgICBjb25zdCBieUNhdGVnb3J5ID0gT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgICAgQ0FURUdPUklFUy5tYXAoKGNhdGVnb3J5KSA9PiB7XG4gICAgICAgIGNvbnN0IGNhdGVnb3J5UGVuYWx0eSA9IGZpbGVzU2Nhbm5lZCA+IDAgPyAocGVuYWx0aWVzQnlDYXRlZ29yeVtjYXRlZ29yeV0gLyBmaWxlc1NjYW5uZWQpICogOCA6IDA7XG4gICAgICAgIGNvbnN0IHNjb3JlID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oMTAwLCBNYXRoLnJvdW5kKDEwMCAtIGNhdGVnb3J5UGVuYWx0eSkpKTtcbiAgICAgICAgcmV0dXJuIFtjYXRlZ29yeSwgc2NvcmVdO1xuICAgICAgfSksXG4gICAgKSBhcyBIZWFsdGhTY29yZUJyZWFrZG93bltcImJ5Q2F0ZWdvcnlcIl07XG5cbiAgICByZXR1cm4ge1xuICAgICAgdG90YWwsXG4gICAgICBieUNhdGVnb3J5LFxuICAgICAgcGVuYWx0eVBvaW50czogTnVtYmVyKHRvdGFsUGVuYWx0eS50b0ZpeGVkKDIpKSxcbiAgICAgIGlzc3VlQ291bnRCeVNldmVyaXR5LFxuICAgIH07XG4gIH1cbn1cclxuIiwgIlx1RkVGRmV4cG9ydCBjbGFzcyBTY2hlZHVsZXIge1xuICBhc3luYyB5aWVsZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4gcmVzb2x2ZSgpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHJlc29sdmUoKSwgMCk7XG4gICAgfSk7XG4gIH1cbn1cclxuIiwgIlx1RkVGRmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVQYXRoTGlrZShpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGlucHV0LnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpLnRyaW0oKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzSWdub3JlZFBhdGgocGF0aDogc3RyaW5nLCBpZ25vcmVkRm9sZGVyczogc3RyaW5nW10pOiBib29sZWFuIHtcbiAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZVBhdGhMaWtlKHBhdGgpLnRvTG93ZXJDYXNlKCk7XG5cbiAgcmV0dXJuIGlnbm9yZWRGb2xkZXJzLnNvbWUoKGZvbGRlcikgPT4ge1xuICAgIGNvbnN0IGNhbmRpZGF0ZSA9IG5vcm1hbGl6ZVBhdGhMaWtlKGZvbGRlcikudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gbm9ybWFsaXplZCA9PT0gY2FuZGlkYXRlIHx8IG5vcm1hbGl6ZWQuc3RhcnRzV2l0aChgJHtjYW5kaWRhdGV9L2ApO1xuICB9KTtcbn1cclxuIiwgIlx1RkVGRmV4cG9ydCBmdW5jdGlvbiBjaHVua0FycmF5PFQ+KGl0ZW1zOiBUW10sIHNpemU6IG51bWJlcik6IFRbXVtdIHtcbiAgaWYgKHNpemUgPD0gMCkge1xuICAgIHJldHVybiBbaXRlbXNdO1xuICB9XG5cbiAgY29uc3QgY2h1bmtzOiBUW11bXSA9IFtdO1xuICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgaXRlbXMubGVuZ3RoOyBpbmRleCArPSBzaXplKSB7XG4gICAgY2h1bmtzLnB1c2goaXRlbXMuc2xpY2UoaW5kZXgsIGluZGV4ICsgc2l6ZSkpO1xuICB9XG5cbiAgcmV0dXJuIGNodW5rcztcbn1cclxuIiwgIlx1RkVGRmltcG9ydCB7IEFwcCwgVEZpbGUgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIHtcbiAgQXVkaXRJc3N1ZSxcbiAgQXVkaXRQcm9ncmVzcyxcbiAgUnVsZVJlZ2lzdHJ5TGlrZSxcbiAgVmF1bHRBdWRpdFJlc3VsdCxcbiAgVmF1bHRJbmRleCxcbn0gZnJvbSBcIi4uL3R5cGVzL2F1ZGl0XCI7XG5pbXBvcnQgdHlwZSB7IFZhdWx0SGVhbHRoU2V0dGluZ3MgfSBmcm9tIFwiLi4vdHlwZXMvc2V0dGluZ3NcIjtcbmltcG9ydCB7IGlzSWdub3JlZFBhdGggfSBmcm9tIFwiLi4vdXRpbHMvcGF0aFwiO1xuaW1wb3J0IHsgY2h1bmtBcnJheSB9IGZyb20gXCIuLi91dGlscy9iYXRjaFwiO1xuaW1wb3J0IHsgU25hcHNob3RCdWlsZGVyIH0gZnJvbSBcIi4vU25hcHNob3RCdWlsZGVyXCI7XG5pbXBvcnQgeyBIZWFsdGhTY29yZVNlcnZpY2UgfSBmcm9tIFwiLi4vc2NvcmluZy9IZWFsdGhTY29yZVNlcnZpY2VcIjtcbmltcG9ydCB7IEF1ZGl0UmVwb3NpdG9yeSB9IGZyb20gXCIuL0F1ZGl0UmVwb3NpdG9yeVwiO1xuaW1wb3J0IHsgU2NoZWR1bGVyIH0gZnJvbSBcIi4vU2NoZWR1bGVyXCI7XG5cbmV4cG9ydCBjbGFzcyBBdWRpdEVuZ2luZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSByZWFkb25seSBzbmFwc2hvdEJ1aWxkZXI6IFNuYXBzaG90QnVpbGRlcixcbiAgICBwcml2YXRlIHJlYWRvbmx5IHJ1bGVSZWdpc3RyeTogUnVsZVJlZ2lzdHJ5TGlrZSxcbiAgICBwcml2YXRlIHJlYWRvbmx5IHNjb3JlU2VydmljZTogSGVhbHRoU2NvcmVTZXJ2aWNlLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgcmVwb3NpdG9yeTogQXVkaXRSZXBvc2l0b3J5LFxuICAgIHByaXZhdGUgcmVhZG9ubHkgc2NoZWR1bGVyOiBTY2hlZHVsZXIsXG4gICAgcHJpdmF0ZSByZWFkb25seSBzZXR0aW5nc1Byb3ZpZGVyOiAoKSA9PiBWYXVsdEhlYWx0aFNldHRpbmdzLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgb25Qcm9ncmVzcz86IChwcm9ncmVzczogQXVkaXRQcm9ncmVzcykgPT4gdm9pZCxcbiAgKSB7fVxuXG4gIGFzeW5jIHJ1bkZ1bGxBdWRpdCgpOiBQcm9taXNlPFZhdWx0QXVkaXRSZXN1bHQ+IHtcbiAgICBjb25zdCBzZXR0aW5ncyA9IHRoaXMuc2V0dGluZ3NQcm92aWRlcigpO1xuICAgIGNvbnN0IGZpbGVzID0gdGhpcy5nZXRFbGlnaWJsZUZpbGVzKHNldHRpbmdzKTtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMuYnVpbGRJbmRleChmaWxlcyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5ydW4oZmlsZXMsIGluZGV4KTtcbiAgICBhd2FpdCB0aGlzLnJlcG9zaXRvcnkuc2F2ZVJlc3VsdChyZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBhc3luYyBydW5JbmNyZW1lbnRhbEF1ZGl0KHBhdGhzOiBzdHJpbmdbXSk6IFByb21pc2U8VmF1bHRBdWRpdFJlc3VsdD4ge1xuICAgIGNvbnN0IHNldHRpbmdzID0gdGhpcy5zZXR0aW5nc1Byb3ZpZGVyKCk7XG4gICAgY29uc3QgZWxpZ2libGVGaWxlcyA9IHRoaXMuZ2V0RWxpZ2libGVGaWxlcyhzZXR0aW5ncyk7XG4gICAgY29uc3QgZGlydHlTZXQgPSBuZXcgU2V0KHBhdGhzKTtcbiAgICBjb25zdCBmaWxlcyA9IGVsaWdpYmxlRmlsZXMuZmlsdGVyKChmaWxlKSA9PiBkaXJ0eVNldC5oYXMoZmlsZS5wYXRoKSk7XG5cbiAgICBpZiAoZmlsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zdCBsYXN0UmVzdWx0ID0gYXdhaXQgdGhpcy5yZXBvc2l0b3J5LmdldExhc3RSZXN1bHQoKTtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIGxhc3RSZXN1bHQgPz8ge1xuICAgICAgICAgIHN0YXJ0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgICBmaW5pc2hlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICAgIGZpbGVzU2Nhbm5lZDogMCxcbiAgICAgICAgICBpc3N1ZXM6IFtdLFxuICAgICAgICAgIGJyZWFrZG93bjogdGhpcy5zY29yZVNlcnZpY2UuY2FsY3VsYXRlKFtdLCAwKSxcbiAgICAgICAgICB0b3BPZmZlbmRlcnM6IFtdLFxuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5idWlsZEluZGV4KGVsaWdpYmxlRmlsZXMpO1xuICAgIGNvbnN0IHBhcnRpYWxSZXN1bHQgPSBhd2FpdCB0aGlzLnJ1bihmaWxlcywgaW5kZXgpO1xuICAgIGNvbnN0IHByZXZpb3VzID0gYXdhaXQgdGhpcy5yZXBvc2l0b3J5LmdldExhc3RSZXN1bHQoKTtcblxuICAgIGNvbnN0IG1lcmdlZElzc3VlcyA9IHRoaXMubWVyZ2VJc3N1ZXMocHJldmlvdXM/Lmlzc3VlcyA/PyBbXSwgcGFydGlhbFJlc3VsdC5pc3N1ZXMsIGZpbGVzLm1hcCgoZmlsZSkgPT4gZmlsZS5wYXRoKSk7XG4gICAgY29uc3QgbWVyZ2VkUmVzdWx0OiBWYXVsdEF1ZGl0UmVzdWx0ID0ge1xuICAgICAgc3RhcnRlZEF0OiBwYXJ0aWFsUmVzdWx0LnN0YXJ0ZWRBdCxcbiAgICAgIGZpbmlzaGVkQXQ6IHBhcnRpYWxSZXN1bHQuZmluaXNoZWRBdCxcbiAgICAgIGZpbGVzU2Nhbm5lZDogcHJldmlvdXM/LmZpbGVzU2Nhbm5lZCA/PyBlbGlnaWJsZUZpbGVzLmxlbmd0aCxcbiAgICAgIGlzc3VlczogbWVyZ2VkSXNzdWVzLFxuICAgICAgYnJlYWtkb3duOiB0aGlzLnNjb3JlU2VydmljZS5jYWxjdWxhdGUobWVyZ2VkSXNzdWVzLCBwcmV2aW91cz8uZmlsZXNTY2FubmVkID8/IGVsaWdpYmxlRmlsZXMubGVuZ3RoKSxcbiAgICAgIHRvcE9mZmVuZGVyczogdGhpcy5jb21wdXRlVG9wT2ZmZW5kZXJzKG1lcmdlZElzc3VlcyksXG4gICAgfTtcblxuICAgIGF3YWl0IHRoaXMucmVwb3NpdG9yeS5zYXZlUmVzdWx0KG1lcmdlZFJlc3VsdCk7XG4gICAgcmV0dXJuIG1lcmdlZFJlc3VsdDtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0RWxpZ2libGVGaWxlcyhzZXR0aW5nczogVmF1bHRIZWFsdGhTZXR0aW5ncyk6IFRGaWxlW10ge1xuICAgIHJldHVybiB0aGlzLmFwcC52YXVsdFxuICAgICAgLmdldE1hcmtkb3duRmlsZXMoKVxuICAgICAgLmZpbHRlcigoZmlsZSkgPT4gIWlzSWdub3JlZFBhdGgoZmlsZS5wYXRoLCBzZXR0aW5ncy5pZ25vcmVkRm9sZGVycykpO1xuICB9XG5cbiAgcHJpdmF0ZSBidWlsZEluZGV4KGZpbGVzOiBURmlsZVtdKTogVmF1bHRJbmRleCB7XG4gICAgY29uc3QgaW5saW5rczogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHt9O1xuICAgIGNvbnN0IG91dGxpbmtzOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge307XG4gICAgY29uc3QgYWxsUGF0aHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgYWxsUGF0aHMuYWRkKGZpbGUucGF0aCk7XG4gICAgICBjb25zdCBjYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xuICAgICAgY29uc3QgbGlua3MgPSBjYWNoZT8ubGlua3M/Lm1hcCgobGluaykgPT4gbGluay5saW5rKSA/PyBbXTtcbiAgICAgIG91dGxpbmtzW2ZpbGUucGF0aF0gPSBsaW5rcy5sZW5ndGg7XG5cbiAgICAgIGZvciAoY29uc3QgbGluayBvZiBsaW5rcykge1xuICAgICAgICBjb25zdCBkZXN0aW5hdGlvbiA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QobGluaywgZmlsZS5wYXRoKTtcbiAgICAgICAgaWYgKGRlc3RpbmF0aW9uKSB7XG4gICAgICAgICAgaW5saW5rc1tkZXN0aW5hdGlvbi5wYXRoXSA9IChpbmxpbmtzW2Rlc3RpbmF0aW9uLnBhdGhdID8/IDApICsgMTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7IGFsbFBhdGhzLCBpbmxpbmtzLCBvdXRsaW5rcyB9O1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBydW4oZmlsZXM6IFRGaWxlW10sIGluZGV4OiBWYXVsdEluZGV4KTogUHJvbWlzZTxWYXVsdEF1ZGl0UmVzdWx0PiB7XG4gICAgY29uc3Qgc2V0dGluZ3MgPSB0aGlzLnNldHRpbmdzUHJvdmlkZXIoKTtcbiAgICBjb25zdCBzdGFydGVkQXQgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IGlzc3VlczogQXVkaXRJc3N1ZVtdID0gW107XG4gICAgY29uc3QgcnVsZXMgPSB0aGlzLnJ1bGVSZWdpc3RyeS5nZXRSdWxlcyhzZXR0aW5ncyk7XG4gICAgY29uc3QgbWV0YWRhdGFSdWxlcyA9IHJ1bGVzLmZpbHRlcigocnVsZSkgPT4gIXJ1bGUucmVxdWlyZXNDb250ZW50KTtcbiAgICBjb25zdCBjb250ZW50UnVsZXMgPSBydWxlcy5maWx0ZXIoKHJ1bGUpID0+IHJ1bGUucmVxdWlyZXNDb250ZW50KTtcbiAgICBsZXQgc2Nhbm5lZCA9IDA7XG5cbiAgICBmb3IgKGNvbnN0IGJhdGNoIG9mIGNodW5rQXJyYXkoZmlsZXMsIHNldHRpbmdzLmJhdGNoU2l6ZSkpIHtcbiAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBiYXRjaCkge1xuICAgICAgICBjb25zdCBtZXRhZGF0YVNuYXBzaG90ID0gYXdhaXQgdGhpcy5zbmFwc2hvdEJ1aWxkZXIuYnVpbGQoZmlsZSwgaW5kZXgsIGZhbHNlKTtcblxuICAgICAgICBpZiAodGhpcy5oYXNJZ25vcmVkVGFnKG1ldGFkYXRhU25hcHNob3QudGFncywgc2V0dGluZ3MuaWdub3JlZFRhZ3MpKSB7XG4gICAgICAgICAgc2Nhbm5lZCArPSAxO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCBydWxlIG9mIG1ldGFkYXRhUnVsZXMpIHtcbiAgICAgICAgICBjb25zdCBydWxlSXNzdWVzID0gYXdhaXQgcnVsZS5ydW4obWV0YWRhdGFTbmFwc2hvdCwge1xuICAgICAgICAgICAgbm93OiBEYXRlLm5vdygpLFxuICAgICAgICAgICAgc2V0dGluZ3MsXG4gICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpc3N1ZXMucHVzaCguLi5ydWxlSXNzdWVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb250ZW50UnVsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNvbnN0IGZ1bGxTbmFwc2hvdCA9IGF3YWl0IHRoaXMuc25hcHNob3RCdWlsZGVyLmJ1aWxkKGZpbGUsIGluZGV4LCB0cnVlKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHJ1bGUgb2YgY29udGVudFJ1bGVzKSB7XG4gICAgICAgICAgICBjb25zdCBydWxlSXNzdWVzID0gYXdhaXQgcnVsZS5ydW4oZnVsbFNuYXBzaG90LCB7XG4gICAgICAgICAgICAgIG5vdzogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgICAgc2V0dGluZ3MsXG4gICAgICAgICAgICAgIGluZGV4LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaCguLi5ydWxlSXNzdWVzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzY2FubmVkICs9IDE7XG4gICAgICB9XG5cbiAgICAgIHRoaXMub25Qcm9ncmVzcz8uKHtcbiAgICAgICAgc2Nhbm5lZCxcbiAgICAgICAgdG90YWw6IGZpbGVzLmxlbmd0aCxcbiAgICAgIH0pO1xuXG4gICAgICBhd2FpdCB0aGlzLnNjaGVkdWxlci55aWVsZCgpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBzdGFydGVkQXQsXG4gICAgICBmaW5pc2hlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgZmlsZXNTY2FubmVkOiBmaWxlcy5sZW5ndGgsXG4gICAgICBpc3N1ZXMsXG4gICAgICBicmVha2Rvd246IHRoaXMuc2NvcmVTZXJ2aWNlLmNhbGN1bGF0ZShpc3N1ZXMsIGZpbGVzLmxlbmd0aCksXG4gICAgICB0b3BPZmZlbmRlcnM6IHRoaXMuY29tcHV0ZVRvcE9mZmVuZGVycyhpc3N1ZXMpLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIGhhc0lnbm9yZWRUYWcodGFnczogc3RyaW5nW10sIGlnbm9yZWRUYWdzOiBzdHJpbmdbXSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRUYWdzID0gbmV3IFNldCh0YWdzLm1hcCgodGFnKSA9PiB0YWcudG9Mb3dlckNhc2UoKSkpO1xuICAgIHJldHVybiBpZ25vcmVkVGFncy5zb21lKCh0YWcpID0+IG5vcm1hbGl6ZWRUYWdzLmhhcyh0YWcudG9Mb3dlckNhc2UoKSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBtZXJnZUlzc3VlcyhleGlzdGluZzogQXVkaXRJc3N1ZVtdLCBpbmNvbWluZzogQXVkaXRJc3N1ZVtdLCB0b3VjaGVkUGF0aHM6IHN0cmluZ1tdKTogQXVkaXRJc3N1ZVtdIHtcbiAgICBjb25zdCB0b3VjaGVkID0gbmV3IFNldCh0b3VjaGVkUGF0aHMpO1xuICAgIHJldHVybiBbLi4uZXhpc3RpbmcuZmlsdGVyKChpc3N1ZSkgPT4gIXRvdWNoZWQuaGFzKGlzc3VlLmZpbGVQYXRoKSksIC4uLmluY29taW5nXTtcbiAgfVxuXG4gIHByaXZhdGUgY29tcHV0ZVRvcE9mZmVuZGVycyhpc3N1ZXM6IEF1ZGl0SXNzdWVbXSkge1xuICAgIGNvbnN0IGdyb3VwZWQgPSBuZXcgTWFwPHN0cmluZywgeyBpbXBhY3Q6IG51bWJlcjsgaXNzdWVDb3VudDogbnVtYmVyIH0+KCk7XG5cbiAgICBmb3IgKGNvbnN0IGlzc3VlIG9mIGlzc3Vlcykge1xuICAgICAgY29uc3QgY3VycmVudCA9IGdyb3VwZWQuZ2V0KGlzc3VlLmZpbGVQYXRoKSA/PyB7IGltcGFjdDogMCwgaXNzdWVDb3VudDogMCB9O1xuICAgICAgY3VycmVudC5pbXBhY3QgKz0gaXNzdWUuc2NvcmVJbXBhY3Q7XG4gICAgICBjdXJyZW50Lmlzc3VlQ291bnQgKz0gMTtcbiAgICAgIGdyb3VwZWQuc2V0KGlzc3VlLmZpbGVQYXRoLCBjdXJyZW50KTtcbiAgICB9XG5cbiAgICByZXR1cm4gQXJyYXkuZnJvbShncm91cGVkLmVudHJpZXMoKSlcbiAgICAgIC5tYXAoKFtwYXRoLCBtZXRyaWNzXSkgPT4gKHtcbiAgICAgICAgcGF0aCxcbiAgICAgICAgaW1wYWN0OiBtZXRyaWNzLmltcGFjdCxcbiAgICAgICAgaXNzdWVDb3VudDogbWV0cmljcy5pc3N1ZUNvdW50LFxuICAgICAgfSkpXG4gICAgICAuc29ydCgobGVmdCwgcmlnaHQpID0+IHJpZ2h0LmltcGFjdCAtIGxlZnQuaW1wYWN0IHx8IHJpZ2h0Lmlzc3VlQ291bnQgLSBsZWZ0Lmlzc3VlQ291bnQpXG4gICAgICAuc2xpY2UoMCwgMTApO1xuICB9XG59XHJcbiIsICJcdUZFRkZpbXBvcnQgeyBJdGVtVmlldywgV29ya3NwYWNlTGVhZiB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgUExVR0lOX05BTUUsIFZJRVdfVFlQRV9EQVNIQk9BUkQgfSBmcm9tIFwiLi4vLi4vY29uc3RhbnRzXCI7XG5pbXBvcnQgdHlwZSBWYXVsdEhlYWx0aEF1ZGl0b3JQbHVnaW4gZnJvbSBcIi4uLy4uL21haW5cIjtcblxuZXhwb3J0IGNsYXNzIERhc2hib2FyZFZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGxlYWY6IFdvcmtzcGFjZUxlYWYsXG4gICAgcHJpdmF0ZSByZWFkb25seSBwbHVnaW46IFZhdWx0SGVhbHRoQXVkaXRvclBsdWdpbixcbiAgKSB7XG4gICAgc3VwZXIobGVhZik7XG4gIH1cblxuICBnZXRWaWV3VHlwZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiBWSUVXX1RZUEVfREFTSEJPQVJEO1xuICB9XG5cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gUExVR0lOX05BTUU7XG4gIH1cblxuICBnZXRJY29uKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIFwiYWN0aXZpdHlcIjtcbiAgfVxuXG4gIGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLnJlbmRlcigpO1xuICB9XG5cbiAgYXN5bmMgcmVuZGVyKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucGx1Z2luLnJlcG9zaXRvcnkuZ2V0TGFzdFJlc3VsdCgpO1xuICAgIGNvbnN0IGhpc3RvcnkgPSBhd2FpdCB0aGlzLnBsdWdpbi5yZXBvc2l0b3J5LmdldEhpc3RvcnkoKTtcblxuICAgIHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG4gICAgdGhpcy5jb250ZW50RWwuYWRkQ2xhc3MoXCJ2aGEtZGFzaGJvYXJkXCIpO1xuXG4gICAgY29uc3QgaGVhZGVyID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcInZoYS1oZWFkZXJcIiB9KTtcbiAgICBoZWFkZXIuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiVmF1bHQgSGVhbHRoIEF1ZGl0b3JcIiB9KTtcblxuICAgIGNvbnN0IGFjdGlvblJvdyA9IGhlYWRlci5jcmVhdGVEaXYoeyBjbHM6IFwidmhhLWFjdGlvbnNcIiB9KTtcbiAgICBjb25zdCBmdWxsQXVkaXRCdXR0b24gPSBhY3Rpb25Sb3cuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgdGV4dDogXCJSdW4gZnVsbCBhdWRpdFwiLFxuICAgICAgY2xzOiBcIm1vZC1jdGFcIixcbiAgICB9KTtcbiAgICBmdWxsQXVkaXRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnJ1bkZ1bGxBdWRpdCgpO1xuICAgICAgYXdhaXQgdGhpcy5yZW5kZXIoKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGluY3JlbWVudGFsQnV0dG9uID0gYWN0aW9uUm93LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgIHRleHQ6IFwiUnVuIGluY3JlbWVudGFsIGF1ZGl0XCIsXG4gICAgfSk7XG4gICAgaW5jcmVtZW50YWxCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnJ1bkluY3JlbWVudGFsQXVkaXQoKTtcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyKCk7XG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgdGhpcy5jb250ZW50RWwuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgICAgdGV4dDogXCJOZW5odW1hIGF1ZGl0b3JpYSBmb2kgZXhlY3V0YWRhIGFpbmRhLiBSb2RlIHVtIGZ1bGwgYXVkaXQgcGFyYSBnZXJhciBvcyBwcmltZWlyb3MgcmVzdWx0YWRvcy5cIixcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGNhcmRzID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcInZoYS1jYXJkc1wiIH0pO1xuICAgIHRoaXMuY3JlYXRlQ2FyZChjYXJkcywgXCJIZWFsdGggU2NvcmVcIiwgU3RyaW5nKHJlc3VsdC5icmVha2Rvd24udG90YWwpKTtcbiAgICB0aGlzLmNyZWF0ZUNhcmQoY2FyZHMsIFwiRmlsZXMgc2Nhbm5lZFwiLCBTdHJpbmcocmVzdWx0LmZpbGVzU2Nhbm5lZCkpO1xuICAgIHRoaXMuY3JlYXRlQ2FyZChjYXJkcywgXCJJc3N1ZXMgZm91bmRcIiwgU3RyaW5nKHJlc3VsdC5pc3N1ZXMubGVuZ3RoKSk7XG4gICAgdGhpcy5jcmVhdGVDYXJkKGNhcmRzLCBcIlByb2dyZXNzXCIsIGAke3RoaXMucGx1Z2luLnByb2dyZXNzLnNjYW5uZWR9LyR7dGhpcy5wbHVnaW4ucHJvZ3Jlc3MudG90YWx9YCk7XG5cbiAgICBjb25zdCBzZXZlcml0eUJsb2NrID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcInZoYS1ibG9ja1wiIH0pO1xuICAgIHNldmVyaXR5QmxvY2suY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IFwiU2V2ZXJpdHkgYnJlYWtkb3duXCIgfSk7XG4gICAgc2V2ZXJpdHlCbG9jay5jcmVhdGVFbChcInByZVwiLCB7XG4gICAgICB0ZXh0OiBKU09OLnN0cmluZ2lmeShyZXN1bHQuYnJlYWtkb3duLmlzc3VlQ291bnRCeVNldmVyaXR5LCBudWxsLCAyKSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNhdGVnb3J5QmxvY2sgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwidmhhLWJsb2NrXCIgfSk7XG4gICAgY2F0ZWdvcnlCbG9jay5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogXCJDYXRlZ29yeSBzY29yZXNcIiB9KTtcbiAgICBjYXRlZ29yeUJsb2NrLmNyZWF0ZUVsKFwicHJlXCIsIHtcbiAgICAgIHRleHQ6IEpTT04uc3RyaW5naWZ5KHJlc3VsdC5icmVha2Rvd24uYnlDYXRlZ29yeSwgbnVsbCwgMiksXG4gICAgfSk7XG5cbiAgICBjb25zdCBvZmZlbmRlcnNCbG9jayA9IHRoaXMuY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogXCJ2aGEtYmxvY2tcIiB9KTtcbiAgICBvZmZlbmRlcnNCbG9jay5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogXCJUb3Agb2ZmZW5kZXJzXCIgfSk7XG4gICAgaWYgKHJlc3VsdC50b3BPZmZlbmRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBvZmZlbmRlcnNCbG9jay5jcmVhdGVFbChcInBcIiwgeyB0ZXh0OiBcIlNlbSBkZXN0YXF1ZXMgbmVnYXRpdm9zIG5vIG1vbWVudG8uXCIgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG9mZmVuZGVyc0xpc3QgPSBvZmZlbmRlcnNCbG9jay5jcmVhdGVFbChcIm9sXCIpO1xuICAgICAgZm9yIChjb25zdCBvZmZlbmRlciBvZiByZXN1bHQudG9wT2ZmZW5kZXJzKSB7XG4gICAgICAgIG9mZmVuZGVyc0xpc3QuY3JlYXRlRWwoXCJsaVwiLCB7XG4gICAgICAgICAgdGV4dDogYCR7b2ZmZW5kZXIucGF0aH0gXHUwMEUyXHUyMEFDXHUyMDFEIGltcGFjdCAke29mZmVuZGVyLmltcGFjdH0gLyAke29mZmVuZGVyLmlzc3VlQ291bnR9IGlzc3VlKHMpYCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgaXNzdWVzQmxvY2sgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwidmhhLWJsb2NrXCIgfSk7XG4gICAgaXNzdWVzQmxvY2suY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IFwiUmVjZW50IGlzc3Vlc1wiIH0pO1xuICAgIGlmIChyZXN1bHQuaXNzdWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgaXNzdWVzQmxvY2suY3JlYXRlRWwoXCJwXCIsIHsgdGV4dDogXCJOZW5odW1hIGlzc3VlIGVuY29udHJhZGEuXCIgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGlzc3Vlc0xpc3QgPSBpc3N1ZXNCbG9jay5jcmVhdGVEaXYoeyBjbHM6IFwidmhhLWlzc3Vlc1wiIH0pO1xuICAgICAgZm9yIChjb25zdCBpc3N1ZSBvZiByZXN1bHQuaXNzdWVzLnNsaWNlKDAsIDUwKSkge1xuICAgICAgICBjb25zdCBpdGVtID0gaXNzdWVzTGlzdC5jcmVhdGVEaXYoeyBjbHM6IGB2aGEtaXNzdWUgdmhhLSR7aXNzdWUuc2V2ZXJpdHl9YCB9KTtcbiAgICAgICAgaXRlbS5jcmVhdGVFbChcInN0cm9uZ1wiLCB7IHRleHQ6IGBbJHtpc3N1ZS5zZXZlcml0eS50b1VwcGVyQ2FzZSgpfV0gJHtpc3N1ZS50aXRsZX1gIH0pO1xuICAgICAgICBpdGVtLmNyZWF0ZUVsKFwiZGl2XCIsIHsgdGV4dDogaXNzdWUuZmlsZVBhdGggfSk7XG4gICAgICAgIGl0ZW0uY3JlYXRlRWwoXCJwXCIsIHsgdGV4dDogaXNzdWUubWVzc2FnZSB9KTtcblxuICAgICAgICBpZiAoaXNzdWUuZXZpZGVuY2U/Lmxlbmd0aCkge1xuICAgICAgICAgIGl0ZW0uY3JlYXRlRWwoXCJwcmVcIiwgeyB0ZXh0OiBpc3N1ZS5ldmlkZW5jZS5qb2luKFwiXFxuXCIpIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgaGlzdG9yeUJsb2NrID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcInZoYS1ibG9ja1wiIH0pO1xuICAgIGhpc3RvcnlCbG9jay5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogXCJIaXN0b3J5XCIgfSk7XG4gICAgaWYgKGhpc3RvcnkubGVuZ3RoID09PSAwKSB7XG4gICAgICBoaXN0b3J5QmxvY2suY3JlYXRlRWwoXCJwXCIsIHsgdGV4dDogXCJBaW5kYSBuXHUwMEMzXHUwMEEzbyBoXHUwMEMzXHUwMEExIGhpc3RcdTAwQzNcdTAwQjNyaWNvIHBlcnNpc3RpZG8uXCIgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGhpc3RvcnlMaXN0ID0gaGlzdG9yeUJsb2NrLmNyZWF0ZUVsKFwidWxcIik7XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGhpc3Rvcnkuc2xpY2UoLTEwKS5yZXZlcnNlKCkpIHtcbiAgICAgICAgaGlzdG9yeUxpc3QuY3JlYXRlRWwoXCJsaVwiLCB7XG4gICAgICAgICAgdGV4dDogYCR7bmV3IERhdGUoZW50cnkudGltZXN0YW1wKS50b0xvY2FsZVN0cmluZygpfSBcdTAwRTJcdTIwQUNcdTIwMUQgc2NvcmUgJHtlbnRyeS50b3RhbH0sIGlzc3VlcyAke2VudHJ5Lmlzc3VlQ291bnR9LCBmaWxlcyAke2VudHJ5LmZpbGVzU2Nhbm5lZH1gLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUNhcmQoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgdGl0bGU6IHN0cmluZywgdmFsdWU6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGNhcmQgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiBcInZoYS1jYXJkXCIgfSk7XG4gICAgY2FyZC5jcmVhdGVFbChcInNtYWxsXCIsIHsgdGV4dDogdGl0bGUgfSk7XG4gICAgY2FyZC5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogdmFsdWUgfSk7XG4gIH1cbn1cclxuIiwgIlx1RkVGRmltcG9ydCB7IEFwcCwgTm90aWNlLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSBWYXVsdEhlYWx0aEF1ZGl0b3JQbHVnaW4gZnJvbSBcIi4uLy4uL21haW5cIjtcblxuZXhwb3J0IGNsYXNzIFZhdWx0SGVhbHRoU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIHJlYWRvbmx5IHBsdWdpbjogVmF1bHRIZWFsdGhBdWRpdG9yUGx1Z2luLFxuICApIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcblxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIlZhdWx0IEhlYWx0aCBBdWRpdG9yIHNldHRpbmdzXCIgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiUnVuIGZ1bGwgYXVkaXQgb24gc3RhcnR1cFwiKVxuICAgICAgLnNldERlc2MoXCJFeGVjdXRhIHVtYSBhdWRpdG9yaWEgY29tcGxldGEgc2VtcHJlIHF1ZSBvIE9ic2lkaWFuIGluaWNpYXIuXCIpXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5mdWxsQXVkaXRPblN0YXJ0dXApXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZnVsbEF1ZGl0T25TdGFydHVwID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlUGx1Z2luU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiQ3VzdG9tIHJldmlldyBmaWVsZFwiKVxuICAgICAgLnNldERlc2MoXCJDYW1wbyBkZSBmcm9udG1hdHRlciB1c2FkbyBjb21vIGRhdGEgZGUgcmV2aXNcdTAwQzNcdTAwQTNvLCBwb3IgZXhlbXBsbzogcmV2aWV3ZWRfYXRcIilcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwicmV2aWV3ZWRfYXRcIilcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuY3VzdG9tUmV2aWV3RmllbGQpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY3VzdG9tUmV2aWV3RmllbGQgPSB2YWx1ZS50cmltKCkgfHwgXCJyZXZpZXdlZF9hdFwiO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVBsdWdpblNldHRpbmdzKCk7XG4gICAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkJhdGNoIHNpemVcIilcbiAgICAgIC5zZXREZXNjKFwiUXVhbnRpZGFkZSBkZSBub3RhcyBwcm9jZXNzYWRhcyBwb3IgbG90ZS5cIilcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFZhbHVlKFN0cmluZyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5iYXRjaFNpemUpKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IE51bWJlcih2YWx1ZSk7XG4gICAgICAgICAgICBpZiAoTnVtYmVyLmlzRmluaXRlKHBhcnNlZCkgJiYgcGFyc2VkID4gMCkge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5iYXRjaFNpemUgPSBwYXJzZWQ7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5TZXR0aW5ncygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJMYXJnZSBub3RlIHRocmVzaG9sZFwiKVxuICAgICAgLnNldERlc2MoXCJRdWFudGlkYWRlIG1cdTAwQzNcdTAwQURuaW1hIGRlIHBhbGF2cmFzIHBhcmEgY2xhc3NpZmljYXIgbm90YSBjb21vIGdyYW5kZS5cIilcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFZhbHVlKFN0cmluZyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYXJnZU5vdGVXb3JkVGhyZXNob2xkKSlcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBOdW1iZXIodmFsdWUpO1xuICAgICAgICAgICAgaWYgKE51bWJlci5pc0Zpbml0ZShwYXJzZWQpICYmIHBhcnNlZCA+IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MubGFyZ2VOb3RlV29yZFRocmVzaG9sZCA9IHBhcnNlZDtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVBsdWdpblNldHRpbmdzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIk5vdGUgdHlwZSBwb2xpY2llcyAoSlNPTilcIilcbiAgICAgIC5zZXREZXNjKFwiRWRpdGUgYXMgcG9sXHUwMEMzXHUwMEFEdGljYXMgcG9yIHRpcG8gZGUgbm90YSBlbSBKU09OLlwiKVxuICAgICAgLmFkZFRleHRBcmVhKCh0ZXh0KSA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiW11cIilcbiAgICAgICAgICAuc2V0VmFsdWUoSlNPTi5zdHJpbmdpZnkodGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZVR5cGVQb2xpY2llcywgbnVsbCwgMikpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZSh2YWx1ZSk7XG4gICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShwYXJzZWQpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTyB2YWxvciBwcmVjaXNhIHNlciB1bSBhcnJheSBKU09OLlwiKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVUeXBlUG9saWNpZXMgPSBwYXJzZWQ7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5TZXR0aW5ncygpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgbmV3IE5vdGljZShgSlNPTiBpbnZcdTAwQzNcdTAwQTFsaWRvIGVtIG5vdGVUeXBlUG9saWNpZXM6ICR7U3RyaW5nKGVycm9yKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KSxcbiAgICAgICk7XG4gIH1cbn1cclxuIiwgIlx1RkVGRmV4cG9ydCBjbGFzcyBJbmNyZW1lbnRhbEluZGV4ZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IGRpcnR5UGF0aHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBtYXJrRGlydHkocGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5kaXJ0eVBhdGhzLmFkZChwYXRoKTtcbiAgfVxuXG4gIG1hcmtEZWxldGVkKHBhdGg6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuZGlydHlQYXRocy5hZGQocGF0aCk7XG4gIH1cblxuICBjbGVhcigpOiB2b2lkIHtcbiAgICB0aGlzLmRpcnR5UGF0aHMuY2xlYXIoKTtcbiAgfVxuXG4gIGNvbnN1bWVEaXJ0eSgpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgcGF0aHMgPSBBcnJheS5mcm9tKHRoaXMuZGlydHlQYXRocyk7XG4gICAgdGhpcy5kaXJ0eVBhdGhzLmNsZWFyKCk7XG4gICAgcmV0dXJuIHBhdGhzO1xuICB9XG59XHJcbiIsICJcdUZFRkZpbXBvcnQgdHlwZSBWYXVsdEhlYWx0aEF1ZGl0b3JQbHVnaW4gZnJvbSBcIi4uL21haW5cIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9wZW5EYXNoYm9hcmQocGx1Z2luOiBWYXVsdEhlYWx0aEF1ZGl0b3JQbHVnaW4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgcGx1Z2luLmVuc3VyZURhc2hib2FyZE9wZW4oKTtcbn1cclxuIiwgIlx1RkVGRmltcG9ydCB0eXBlIFZhdWx0SGVhbHRoQXVkaXRvclBsdWdpbiBmcm9tIFwiLi4vbWFpblwiO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuRnVsbEF1ZGl0Q29tbWFuZChwbHVnaW46IFZhdWx0SGVhbHRoQXVkaXRvclBsdWdpbik6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBwbHVnaW4ucnVuRnVsbEF1ZGl0KCk7XG59XHJcbiIsICJcdUZFRkZpbXBvcnQgdHlwZSBWYXVsdEhlYWx0aEF1ZGl0b3JQbHVnaW4gZnJvbSBcIi4uL21haW5cIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1bkluY3JlbWVudGFsQXVkaXRDb21tYW5kKHBsdWdpbjogVmF1bHRIZWFsdGhBdWRpdG9yUGx1Z2luKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IHBsdWdpbi5ydW5JbmNyZW1lbnRhbEF1ZGl0KCk7XG59XHJcbiIsICJcdUZFRkZleHBvcnQgY29uc3QgbG9nZ2VyID0ge1xuICBpbmZvOiAoLi4uYXJnczogdW5rbm93bltdKSA9PiBjb25zb2xlLmluZm8oXCJbVmF1bHRIZWFsdGhBdWRpdG9yXVwiLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gY29uc29sZS53YXJuKFwiW1ZhdWx0SGVhbHRoQXVkaXRvcl1cIiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJnczogdW5rbm93bltdKSA9PiBjb25zb2xlLmVycm9yKFwiW1ZhdWx0SGVhbHRoQXVkaXRvcl1cIiwgLi4uYXJncyksXG59O1xyXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQyxJQUFBQSxtQkFBcUQ7OztBQ0cvQyxJQUFNLGNBQWM7QUFDcEIsSUFBTSxzQkFBc0I7QUFFNUIsSUFBTSxtQkFBd0M7QUFBQSxFQUNuRCxjQUFjO0FBQUEsSUFDWjtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBQUEsRUFDQSxrQkFBa0I7QUFBQSxJQUNoQjtBQUFBLE1BQ0UsVUFBVTtBQUFBLE1BQ1YscUJBQXFCLENBQUMsVUFBVSxRQUFRLFFBQVE7QUFBQSxNQUNoRCxpQkFBaUI7QUFBQSxNQUNqQixnQkFBZ0I7QUFBQSxJQUNsQjtBQUFBLElBQ0E7QUFBQSxNQUNFLFVBQVU7QUFBQSxNQUNWLHFCQUFxQixDQUFDLFVBQVUsVUFBVSxXQUFXO0FBQUEsTUFDckQsaUJBQWlCO0FBQUEsTUFDakIsZ0JBQWdCO0FBQUEsSUFDbEI7QUFBQSxJQUNBO0FBQUEsTUFDRSxVQUFVO0FBQUEsTUFDVixxQkFBcUIsQ0FBQyxTQUFTO0FBQUEsTUFDL0IsaUJBQWlCO0FBQUEsTUFDakIsZ0JBQWdCO0FBQUEsSUFDbEI7QUFBQSxJQUNBO0FBQUEsTUFDRSxVQUFVO0FBQUEsTUFDVixxQkFBcUIsQ0FBQztBQUFBLE1BQ3RCLGlCQUFpQjtBQUFBLE1BQ2pCLGdCQUFnQjtBQUFBLElBQ2xCO0FBQUEsRUFDRjtBQUFBLEVBQ0EsZ0JBQWdCLENBQUMsYUFBYSxXQUFXO0FBQUEsRUFDekMsYUFBYSxDQUFDLFVBQVU7QUFBQSxFQUN4Qix3QkFBd0I7QUFBQSxFQUN4Qix1QkFBdUI7QUFBQSxFQUN2Qiw2QkFBNkI7QUFBQSxFQUM3QixvQkFBb0I7QUFBQSxFQUNwQixvQkFBb0I7QUFBQSxFQUNwQixXQUFXO0FBQUEsRUFDWCxtQkFBbUI7QUFDckI7OztBQ2pETyxTQUFTLFVBQWEsT0FBYTtBQUN4QyxTQUFPLEtBQUssTUFBTSxLQUFLLFVBQVUsS0FBSyxDQUFDO0FBQ3pDO0FBRU8sU0FBUyxlQUFlLFFBQW1EO0FBQ2hGLFNBQU87QUFBQSxJQUNMLFdBQVcsT0FBTztBQUFBLElBQ2xCLE9BQU8sT0FBTyxVQUFVO0FBQUEsSUFDeEIsWUFBWSxPQUFPLE9BQU87QUFBQSxJQUMxQixjQUFjLE9BQU87QUFBQSxFQUN2QjtBQUNGOzs7QUNPTyxJQUFNLHVCQUEwQztBQUFBLEVBQ3JELFVBQVU7QUFBQSxFQUNWLE9BQU87QUFBQSxJQUNMLFlBQVk7QUFBQSxJQUNaLFNBQVMsQ0FBQztBQUFBLEVBQ1o7QUFDRjs7O0FDaEJPLElBQU0sa0JBQU4sTUFBc0I7QUFBQSxFQUMzQixZQUE2QixRQUFnQjtBQUFoQjtBQUFBLEVBQWlCO0FBQUEsRUFFOUMsTUFBYyxPQUFtQztBQWRuRDtBQWVJLFVBQU0sTUFBTSxNQUFNLEtBQUssT0FBTyxTQUFTO0FBRXZDLFdBQU87QUFBQSxNQUNMLFVBQVU7QUFBQSxRQUNSLEdBQUc7QUFBQSxRQUNILElBQUksZ0NBQUssYUFBTCxZQUFpQixDQUFDO0FBQUEsTUFDeEI7QUFBQSxNQUNBLE9BQU87QUFBQSxRQUNMLGFBQVksc0NBQUssVUFBTCxtQkFBWSxlQUFaLFlBQTBCLHFCQUFxQixNQUFNO0FBQUEsUUFDakUsVUFBUyxzQ0FBSyxVQUFMLG1CQUFZLFlBQVosWUFBdUIscUJBQXFCLE1BQU07QUFBQSxNQUM3RDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFNLFlBQVksV0FBZ0Msa0JBQWdEO0FBQ2hHLFVBQU0sT0FBTyxNQUFNLEtBQUssS0FBSztBQUM3QixXQUFPO0FBQUEsTUFDTCxHQUFHO0FBQUEsTUFDSCxHQUFHLFVBQVUsS0FBSyxRQUFRO0FBQUEsSUFDNUI7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFNLGFBQWEsVUFBOEM7QUFDL0QsVUFBTSxPQUFPLE1BQU0sS0FBSyxLQUFLO0FBQzdCLFNBQUssV0FBVyxVQUFVLFFBQVE7QUFDbEMsVUFBTSxLQUFLLE9BQU8sU0FBUyxJQUFJO0FBQUEsRUFDakM7QUFBQSxFQUVBLE1BQU0sZ0JBQWtEO0FBQ3RELFVBQU0sT0FBTyxNQUFNLEtBQUssS0FBSztBQUM3QixXQUFPLEtBQUssTUFBTSxhQUFhLFVBQVUsS0FBSyxNQUFNLFVBQVUsSUFBSTtBQUFBLEVBQ3BFO0FBQUEsRUFFQSxNQUFNLGFBQWlEO0FBQ3JELFVBQU0sT0FBTyxNQUFNLEtBQUssS0FBSztBQUM3QixXQUFPLFVBQVUsS0FBSyxNQUFNLE9BQU87QUFBQSxFQUNyQztBQUFBLEVBRUEsTUFBTSxXQUFXLFFBQXlDO0FBQ3hELFVBQU0sT0FBTyxNQUFNLEtBQUssS0FBSztBQUM3QixTQUFLLE1BQU0sYUFBYSxVQUFVLE1BQU07QUFDeEMsU0FBSyxNQUFNLFVBQVUsQ0FBQyxHQUFHLEtBQUssTUFBTSxTQUFTLGVBQWUsTUFBTSxDQUFDLEVBQUUsTUFBTSxHQUFHO0FBQzlFLFVBQU0sS0FBSyxPQUFPLFNBQVMsSUFBSTtBQUFBLEVBQ2pDO0FBQ0Y7OztBQzNEUSxTQUFTLGlCQUFpQixVQUEwQjtBQUMxRCxNQUFJLENBQUMsU0FBUyxXQUFXLEtBQUssR0FBRztBQUMvQixXQUFPO0FBQUEsRUFDVDtBQUVBLFFBQU0sV0FBVyxTQUFTLFFBQVEsU0FBUyxDQUFDO0FBQzVDLE1BQUksYUFBYSxJQUFJO0FBQ25CLFdBQU87QUFBQSxFQUNUO0FBRUEsU0FBTyxTQUFTLE1BQU0sV0FBVyxDQUFDLEVBQUUsVUFBVTtBQUNoRDtBQUVPLFNBQVMsY0FBYyxVQUE0QjtBQUN4RCxTQUFPLGlCQUFpQixRQUFRLEVBQzdCLE1BQU0sVUFBVSxFQUNoQixJQUFJLENBQUMsVUFBVSxNQUFNLEtBQUssQ0FBQyxFQUMzQixPQUFPLENBQUMsVUFBVSxNQUFNLFNBQVMsQ0FBQztBQUN2QztBQUVPLFNBQVMsYUFBYSxVQUEwQjtBQUNyRCxTQUFPLGlCQUFpQixRQUFRLEVBQzdCLFFBQVEsZ0JBQWdCLEdBQUcsRUFDM0IsUUFBUSxtQkFBbUIsR0FBRyxFQUM5QixNQUFNLEtBQUssRUFDWCxPQUFPLE9BQU8sRUFBRTtBQUNyQjtBQUVPLFNBQVMsYUFBYSxVQUEwQjtBQUNyRCxTQUFPLFNBQVMsTUFBTSxPQUFPLEVBQUU7QUFDakM7QUFFTyxTQUFTLGdCQUFnQixVQUEyQjtBQUN6RCxRQUFNLGFBQWEsY0FBYyxRQUFRO0FBQ3pDLE1BQUksV0FBVyxXQUFXLEdBQUc7QUFDM0IsV0FBTztBQUFBLEVBQ1Q7QUFFQSxRQUFNLGlCQUFpQixXQUFXLEtBQUssQ0FBQyxjQUFjLENBQUMsVUFBVSxXQUFXLEdBQUcsQ0FBQztBQUNoRixNQUFJLENBQUMsZ0JBQWdCO0FBQ25CLFdBQU87QUFBQSxFQUNUO0FBRUEsTUFBSSxnQkFBZ0IsS0FBSyxjQUFjLEdBQUc7QUFDeEMsV0FBTztBQUFBLEVBQ1Q7QUFFQSxTQUFPLGVBQWUsVUFBVTtBQUNsQzs7O0FDL0JPLElBQU0sNEJBQU4sTUFBZ0M7QUFBQSxFQUNyQyxRQUFRLFVBQTJDO0FBQ2pELFVBQU0sV0FBVyxpQkFBaUIsUUFBUTtBQUMxQyxVQUFNLFFBQVEsU0FBUyxNQUFNLE9BQU87QUFDcEMsVUFBTSxhQUFhLGNBQWMsUUFBUTtBQUN6QyxVQUFNLGVBQWUsTUFBTSxPQUFPLENBQUMsU0FBUyxhQUFhLEtBQUssSUFBSSxDQUFDLEVBQUU7QUFDckUsVUFBTSxZQUFZLGFBQWEsUUFBUTtBQUN2QyxVQUFNLFlBQVksYUFBYSxRQUFRO0FBQ3ZDLFVBQU0saUJBQWlCLFdBQVc7QUFDbEMsVUFBTSxtQkFBbUIsWUFBWSxJQUFJLGlCQUFpQixZQUFZO0FBRXRFLFdBQU87QUFBQSxNQUNMO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxZQUFZLGdCQUFnQixRQUFRO0FBQUEsTUFDcEM7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGOzs7QUNyQ1EsSUFBTSxTQUFTLE1BQU8sS0FBSyxLQUFLO0FBRWpDLFNBQVMsY0FBYyxPQUErQjtBQUMzRCxNQUFJLFNBQVMsTUFBTTtBQUNqQixXQUFPO0FBQUEsRUFDVDtBQUVBLE1BQUksT0FBTyxVQUFVLFlBQVksT0FBTyxTQUFTLEtBQUssR0FBRztBQUN2RCxXQUFPO0FBQUEsRUFDVDtBQUVBLE1BQUksT0FBTyxVQUFVLFVBQVU7QUFDN0IsVUFBTSxTQUFTLEtBQUssTUFBTSxLQUFLO0FBQy9CLFdBQU8sT0FBTyxNQUFNLE1BQU0sSUFBSSxPQUFPO0FBQUEsRUFDdkM7QUFFQSxTQUFPO0FBQ1Q7QUFFTyxTQUFTLFNBQVMsZUFBdUIsYUFBNkI7QUFDM0UsU0FBTyxLQUFLLE9BQU8sY0FBYyxpQkFBaUIsTUFBTTtBQUMxRDs7O0FDZE8sSUFBTSxrQkFBTixNQUFzQjtBQUFBLEVBRzNCLFlBQ21CLEtBQ0Esa0JBQ2pCO0FBRmlCO0FBQ0E7QUFKbkIsU0FBaUIsb0JBQW9CLElBQUksMEJBQTBCO0FBQUEsRUFLaEU7QUFBQSxFQUVILE1BQU0sTUFBTSxNQUFhLE9BQW1CLGdCQUFnRDtBQWY5RjtBQWdCSSxVQUFNLFFBQVEsS0FBSyxJQUFJLGNBQWMsYUFBYSxJQUFJO0FBQ3RELFVBQU0sZUFBZSxvQ0FBTyxnQkFBUCxZQUFzQixDQUFDO0FBQzVDLFVBQU0sY0FBYyxLQUFLLGlCQUFpQixFQUFFO0FBQzVDLFVBQU0sYUFBYSxpQkFBaUIsTUFBTSxLQUFLLElBQUksTUFBTSxXQUFXLElBQUksSUFBSTtBQUU1RSxVQUFNLFlBQVksYUFDZCxLQUFLLGtCQUFrQixRQUFRLFVBQVUsSUFDekM7QUFBQSxNQUNFLGVBQWMsMENBQU8sYUFBUCxtQkFBaUIsV0FBakIsWUFBMkI7QUFBQSxNQUN6QyxnQkFBZ0I7QUFBQSxNQUNoQixXQUFXO0FBQUEsTUFDWCxXQUFXO0FBQUEsTUFDWCxZQUFZLFFBQVEsWUFBWSxPQUFPO0FBQUEsTUFDdkMsa0JBQWtCO0FBQUEsSUFDcEI7QUFFSixVQUFNLGlCQUFpQixVQUFLLElBQUksY0FBYyxvQkFBdkIsWUFBaUcsQ0FBQztBQUV6SCxXQUFPO0FBQUEsTUFDTCxNQUFNLEtBQUs7QUFBQSxNQUNYLFVBQVUsS0FBSztBQUFBLE1BQ2YsT0FBTyxLQUFLLEtBQUs7QUFBQSxNQUNqQixPQUFPLEtBQUssS0FBSztBQUFBLE1BQ2pCLFdBQVcsS0FBSyxLQUFLO0FBQUEsTUFDckIsUUFBTywwQ0FBTyxVQUFQLG1CQUFjLElBQUksQ0FBQyxTQUFTLEtBQUssVUFBakMsWUFBMEMsQ0FBQztBQUFBLE1BQ2xELGlCQUFpQixPQUFPLE1BQUssbUJBQWMsS0FBSyxJQUFJLE1BQXZCLFlBQTRCLENBQUMsQ0FBQztBQUFBLE1BQzNELGVBQWMsV0FBTSxRQUFRLEtBQUssSUFBSSxNQUF2QixZQUE0QjtBQUFBLE1BQzFDLGdCQUFlLFdBQU0sU0FBUyxLQUFLLElBQUksTUFBeEIsWUFBNkI7QUFBQSxNQUM1QyxXQUNFLDBDQUFPLGFBQVAsbUJBQWlCLElBQUksQ0FBQyxVQUFVO0FBQUEsUUFDOUIsT0FBTyxLQUFLO0FBQUEsUUFDWixNQUFNLEtBQUs7QUFBQSxNQUNiLFFBSEEsWUFHTyxDQUFDO0FBQUEsTUFDVixPQUFNLDBDQUFPLFNBQVAsbUJBQWEsSUFBSSxDQUFDLFFBQVEsSUFBSSxJQUFJLFFBQVEsTUFBTSxFQUFFLE9BQWxELFlBQXdELENBQUM7QUFBQSxNQUMvRDtBQUFBLE1BQ0EsWUFBWSxVQUFVLGNBQWMsUUFBUSxZQUFZLE9BQU87QUFBQSxNQUMvRCxnQkFBZ0IsVUFBVTtBQUFBLE1BQzFCLFdBQVcsVUFBVTtBQUFBLE1BQ3JCLFdBQVcsVUFBVTtBQUFBLE1BQ3JCO0FBQUEsTUFDQSxVQUNFLE9BQU8sWUFBWSxTQUFTLFdBQ3hCLFlBQVksT0FDWixPQUFPLFlBQVksY0FBYyxXQUMvQixZQUFZLFlBQ1o7QUFBQSxNQUNSLGtCQUFrQixjQUFjLFlBQVksV0FBVyxDQUFDO0FBQUEsSUFDMUQ7QUFBQSxFQUNGO0FBQ0Y7OztBQy9ETyxJQUFNLDJCQUFOLE1BQStCO0FBQUEsRUFDcEMsWUFBNkIsVUFBNEI7QUFBNUI7QUFBQSxFQUE2QjtBQUFBLEVBRTFELGNBQWMsVUFBK0M7QUFDM0QsUUFBSSxDQUFDLFVBQVU7QUFDYixhQUFPO0FBQUEsSUFDVDtBQUVBLFdBQU8sS0FBSyxTQUFTO0FBQUEsTUFDbkIsQ0FBQyxXQUFXLE9BQU8sU0FBUyxZQUFZLE1BQU0sU0FBUyxZQUFZO0FBQUEsSUFDckU7QUFBQSxFQUNGO0FBQUEsRUFFQSxjQUFjLGFBQXNDLFVBQTZCO0FBQy9FLFVBQU0sU0FBUyxLQUFLLGNBQWMsUUFBUTtBQUMxQyxRQUFJLENBQUMsUUFBUTtBQUNYLGFBQU8sQ0FBQztBQUFBLElBQ1Y7QUFFQSxXQUFPLE9BQU8sb0JBQW9CLE9BQU8sQ0FBQyxVQUFVO0FBQ2xELFlBQU0sUUFBUSxZQUFZLEtBQUs7QUFDL0IsVUFBSSxTQUFTLE1BQU07QUFDakIsZUFBTztBQUFBLE1BQ1Q7QUFFQSxVQUFJLE9BQU8sVUFBVSxVQUFVO0FBQzdCLGVBQU8sTUFBTSxLQUFLLEVBQUUsV0FBVztBQUFBLE1BQ2pDO0FBRUEsVUFBSSxNQUFNLFFBQVEsS0FBSyxHQUFHO0FBQ3hCLGVBQU8sTUFBTSxXQUFXO0FBQUEsTUFDMUI7QUFFQSxhQUFPO0FBQUEsSUFDVCxDQUFDO0FBQUEsRUFDSDtBQUNGOzs7QUNqQ08sSUFBTSxjQUFOLE1BQXVDO0FBQUEsRUFBdkM7QUFDTCxTQUFTLEtBQUs7QUFDZCxTQUFTLE9BQU87QUFDaEIsU0FBUyxjQUFjO0FBQUE7QUFBQSxFQUV2QixJQUFJLFVBQXdCLEtBQXFDO0FBVm5FO0FBV0ksVUFBTSxVQUFVLElBQUkseUJBQXlCLElBQUksU0FBUyxnQkFBZ0I7QUFDMUUsVUFBTSxTQUFTLFFBQVEsY0FBYyxTQUFTLFFBQVE7QUFDdEQsVUFBTSxrQkFBaUIsc0NBQVEsbUJBQVIsWUFBMEI7QUFFakQsVUFBTSxzQkFBcUIsY0FBUyxxQkFBVCxZQUE2QixTQUFTO0FBQ2pFLFVBQU0sVUFBVSxTQUFTLG9CQUFvQixJQUFJLEdBQUc7QUFFcEQsUUFBSSxXQUFXLGdCQUFnQjtBQUM3QixhQUFPLENBQUM7QUFBQSxJQUNWO0FBRUEsVUFBTSxXQUFXLFVBQVUsaUJBQWlCLElBQUksVUFBVTtBQUUxRCxXQUFPO0FBQUEsTUFDTDtBQUFBLFFBQ0UsUUFBUSxLQUFLO0FBQUEsUUFDYjtBQUFBLFFBQ0EsVUFBVTtBQUFBLFFBQ1YsVUFBVSxTQUFTO0FBQUEsUUFDbkIsT0FBTztBQUFBLFFBQ1AsU0FBUyx3QkFBa0IsT0FBTyw2Q0FBMEMsY0FBYztBQUFBLFFBQzFGLGFBQWEsYUFBYSxVQUFVLElBQUk7QUFBQSxRQUN4QyxVQUFVO0FBQUEsVUFDUjtBQUFBLFVBQ0E7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0Y7OztBQ25DTyxJQUFNLHVCQUFOLE1BQTJCO0FBQUEsRUFDaEMsUUFBUSxVQUFzQztBQUM1QyxVQUFNLFFBQVEsU0FBUyxNQUFNLE9BQU87QUFFcEMsVUFBTSxXQUFXLE1BQU0sT0FBTyxDQUFDLFNBQVM7QUFDdEMsWUFBTSxVQUFVLEtBQUssS0FBSztBQUMxQixVQUFJLENBQUMsU0FBUztBQUNaLGVBQU87QUFBQSxNQUNUO0FBRUEsWUFBTSxlQUFlLGNBQWMsS0FBSyxPQUFPLEtBQUssaUJBQWlCLEtBQUssT0FBTztBQUNqRixVQUFJLENBQUMsY0FBYztBQUNqQixlQUFPO0FBQUEsTUFDVDtBQUVBLFlBQU0sZUFBZSxRQUNsQixRQUFRLGdCQUFnQixFQUFFLEVBQzFCLFFBQVEsbUJBQW1CLEVBQUUsRUFDN0IsUUFBUSxZQUFZLEVBQUUsRUFDdEIsS0FBSztBQUVSLGFBQU8sYUFBYSxTQUFTO0FBQUEsSUFDL0IsQ0FBQztBQUVELFdBQU87QUFBQSxNQUNMLGVBQWUsU0FBUztBQUFBLE1BQ3hCLG1CQUFtQixTQUFTLE1BQU0sR0FBRyxDQUFDO0FBQUEsSUFDeEM7QUFBQSxFQUNGO0FBQ0Y7OztBQzlCTyxJQUFNLGtCQUFOLE1BQTJDO0FBQUEsRUFBM0M7QUFDTCxTQUFTLEtBQUs7QUFDZCxTQUFTLE9BQU87QUFDaEIsU0FBUyxjQUFjO0FBQUE7QUFBQSxFQUV2QixJQUFJLFVBQXNDO0FBQ3hDLFVBQU0sU0FBdUIsQ0FBQztBQUU5QixRQUFJLFNBQVMsZ0JBQWdCLFNBQVMsR0FBRztBQUN2QyxhQUFPLEtBQUs7QUFBQSxRQUNWLFFBQVEsS0FBSztBQUFBLFFBQ2IsVUFBVTtBQUFBLFFBQ1YsVUFBVTtBQUFBLFFBQ1YsVUFBVSxTQUFTO0FBQUEsUUFDbkIsT0FBTztBQUFBLFFBQ1AsU0FBUyxpQkFBaUIsU0FBUyxnQkFBZ0IsTUFBTTtBQUFBLFFBQ3pELFVBQVUsU0FBUyxnQkFBZ0IsTUFBTSxHQUFHLENBQUM7QUFBQSxRQUM3QyxhQUFhO0FBQUEsTUFDZixDQUFDO0FBQUEsSUFDSDtBQUVBLFFBQUksU0FBUyxZQUFZO0FBQ3ZCLFlBQU0sV0FBVyxJQUFJLHFCQUFxQixFQUFFLFFBQVEsU0FBUyxVQUFVO0FBQ3ZFLFVBQUksU0FBUyxnQkFBZ0IsR0FBRztBQUM5QixlQUFPLEtBQUs7QUFBQSxVQUNWLFFBQVEsS0FBSztBQUFBLFVBQ2IsVUFBVTtBQUFBLFVBQ1YsVUFBVTtBQUFBLFVBQ1YsVUFBVSxTQUFTO0FBQUEsVUFDbkIsT0FBTztBQUFBLFVBQ1AsU0FBUyxxQkFBcUIsU0FBUyxhQUFhO0FBQUEsVUFDcEQsVUFBVSxTQUFTO0FBQUEsVUFDbkIsYUFBYTtBQUFBLFFBQ2YsQ0FBQztBQUFBLE1BQ0g7QUFBQSxJQUNGO0FBRUEsV0FBTztBQUFBLEVBQ1Q7QUFDRjs7O0FDeENPLElBQU0saUJBQU4sTUFBMEM7QUFBQSxFQUExQztBQUNMLFNBQVMsS0FBSztBQUNkLFNBQVMsT0FBTztBQUNoQixTQUFTLGNBQWM7QUFBQTtBQUFBLEVBRXZCLElBQUksVUFBc0M7QUFDeEMsUUFBSSxTQUFTLGVBQWUsS0FBSyxTQUFTLGdCQUFnQixHQUFHO0FBQzNELGFBQU8sQ0FBQztBQUFBLElBQ1Y7QUFFQSxXQUFPO0FBQUEsTUFDTDtBQUFBLFFBQ0UsUUFBUSxLQUFLO0FBQUEsUUFDYixVQUFVO0FBQUEsUUFDVixVQUFVO0FBQUEsUUFDVixVQUFVLFNBQVM7QUFBQSxRQUNuQixPQUFPO0FBQUEsUUFDUCxTQUFTO0FBQUEsUUFDVCxhQUFhO0FBQUEsTUFDZjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0Y7OztBQ3JCTyxJQUFNLDBCQUFOLE1BQW1EO0FBQUEsRUFBbkQ7QUFDTCxTQUFTLEtBQUs7QUFDZCxTQUFTLE9BQU87QUFDaEIsU0FBUyxjQUFjO0FBQUE7QUFBQSxFQUV2QixJQUFJLFVBQXdCLEtBQXFDO0FBVG5FO0FBVUksVUFBTSxVQUFVLElBQUkseUJBQXlCLElBQUksU0FBUyxnQkFBZ0I7QUFDMUUsVUFBTSxVQUFVLFFBQVEsY0FBYyxTQUFTLGFBQWEsU0FBUyxRQUFRO0FBRTdFLFFBQUksUUFBUSxXQUFXLEdBQUc7QUFDeEIsYUFBTyxDQUFDO0FBQUEsSUFDVjtBQUVBLFdBQU87QUFBQSxNQUNMO0FBQUEsUUFDRSxRQUFRLEtBQUs7QUFBQSxRQUNiLFVBQVU7QUFBQSxRQUNWLFVBQVU7QUFBQSxRQUNWLFVBQVUsU0FBUztBQUFBLFFBQ25CLE9BQU87QUFBQSxRQUNQLFNBQVMsaUNBQWdDLGNBQVMsYUFBVCxZQUFxQixjQUFjLE1BQU0sUUFBUSxLQUFLLElBQUksQ0FBQztBQUFBLFFBQ3BHLFVBQVU7QUFBQSxRQUNWLGFBQWE7QUFBQSxRQUNiLGFBQWE7QUFBQSxNQUNmO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRjs7O0FDNUJPLElBQU0sNEJBQU4sTUFBcUQ7QUFBQSxFQUFyRDtBQUNMLFNBQVMsS0FBSztBQUNkLFNBQVMsT0FBTztBQUNoQixTQUFTLGNBQWM7QUFDdkIsU0FBUyxrQkFBa0I7QUFBQTtBQUFBLEVBRTNCLElBQUksVUFBd0IsS0FBcUM7QUFDL0QsUUFBSSxDQUFDLFNBQVMsWUFBWTtBQUN4QixhQUFPLENBQUM7QUFBQSxJQUNWO0FBRUEsUUFBSSxTQUFTLFlBQVksSUFBSSxTQUFTLHdCQUF3QjtBQUM1RCxhQUFPLENBQUM7QUFBQSxJQUNWO0FBRUEsUUFBSSxTQUFTLFNBQVMsVUFBVSxHQUFHO0FBQ2pDLGFBQU8sQ0FBQztBQUFBLElBQ1Y7QUFFQSxXQUFPO0FBQUEsTUFDTDtBQUFBLFFBQ0UsUUFBUSxLQUFLO0FBQUEsUUFDYixVQUFVO0FBQUEsUUFDVixVQUFVO0FBQUEsUUFDVixVQUFVLFNBQVM7QUFBQSxRQUNuQixPQUFPO0FBQUEsUUFDUCxTQUFTLGlCQUFpQixTQUFTLFNBQVMsc0JBQXNCLFNBQVMsU0FBUyxNQUFNO0FBQUEsUUFDMUYsYUFBYTtBQUFBLE1BQ2Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGOzs7QUMvQk8sSUFBTSxlQUFOLE1BQXdDO0FBQUEsRUFBeEM7QUFDTCxTQUFTLEtBQUs7QUFDZCxTQUFTLE9BQU87QUFDaEIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsa0JBQWtCO0FBQUE7QUFBQSxFQUUzQixJQUFJLFVBQXdCLEtBQXFDO0FBQy9ELFFBQUksQ0FBQyxTQUFTLFlBQVk7QUFDeEIsYUFBTyxDQUFDO0FBQUEsSUFDVjtBQUVBLFVBQU0sZUFBZSxTQUFTLE1BQU0sVUFBVSxJQUFJLFNBQVM7QUFDM0QsVUFBTSx1QkFDSixTQUFTLFlBQVksSUFDakIsU0FBUyxpQkFBaUIsU0FBUyxZQUFZLElBQUksU0FBUyw4QkFDNUQ7QUFFTixRQUFJLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNCO0FBQzFDLGFBQU8sQ0FBQztBQUFBLElBQ1Y7QUFFQSxXQUFPO0FBQUEsTUFDTDtBQUFBLFFBQ0UsUUFBUSxLQUFLO0FBQUEsUUFDYixVQUFVO0FBQUEsUUFDVixVQUFVO0FBQUEsUUFDVixVQUFVLFNBQVM7QUFBQSxRQUNuQixPQUFPO0FBQUEsUUFDUCxTQUFTLGNBQWMsU0FBUyxNQUFNLE1BQU0sWUFBWSxTQUFTLGNBQWM7QUFBQSxRQUMvRSxhQUFhO0FBQUEsTUFDZjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0Y7OztBQ2hDTyxJQUFNLHFCQUFOLE1BQThDO0FBQUEsRUFBOUM7QUFDTCxTQUFTLEtBQUs7QUFDZCxTQUFTLE9BQU87QUFDaEIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsa0JBQWtCO0FBQUE7QUFBQSxFQUUzQixJQUFJLFVBQXdCLEtBQXFDO0FBQy9ELFVBQU0sVUFBVSxJQUFJLHlCQUF5QixJQUFJLFNBQVMsZ0JBQWdCO0FBQzFFLFVBQU0sU0FBUyxRQUFRLGNBQWMsU0FBUyxRQUFRO0FBRXRELFFBQUksRUFBQyxpQ0FBUSxrQkFBaUI7QUFDNUIsYUFBTyxDQUFDO0FBQUEsSUFDVjtBQUVBLFFBQUksU0FBUyxZQUFZO0FBQ3ZCLGFBQU8sQ0FBQztBQUFBLElBQ1Y7QUFFQSxXQUFPO0FBQUEsTUFDTDtBQUFBLFFBQ0UsUUFBUSxLQUFLO0FBQUEsUUFDYixVQUFVO0FBQUEsUUFDVixVQUFVO0FBQUEsUUFDVixVQUFVLFNBQVM7QUFBQSxRQUNuQixPQUFPO0FBQUEsUUFDUCxTQUFTLGtCQUFrQixTQUFTLFFBQVE7QUFBQSxRQUM1QyxhQUFhO0FBQUEsTUFDZjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0Y7OztBQzdCTyxJQUFNLGdCQUFOLE1BQW9CO0FBQUEsRUFDekIsUUFBUSxVQUF3QztBQUM5QyxVQUFNLGFBQWEsU0FBUyxRQUFRLFVBQVUsR0FBRztBQUNqRCxVQUFNLFlBQVksV0FDZixNQUFNLGVBQWUsRUFDckIsSUFBSSxDQUFDLGFBQWEsU0FBUyxLQUFLLENBQUMsRUFDakMsT0FBTyxPQUFPO0FBRWpCLFVBQU0sY0FBYyxVQUFVLE9BQU8sQ0FBQyxhQUFhO0FBQ2pELFVBQUksU0FBUyxTQUFTLElBQUk7QUFDeEIsZUFBTztBQUFBLE1BQ1Q7QUFFQSxZQUFNLG1CQUNKO0FBQ0YsWUFBTSxjQUNKLGNBQWMsS0FBSyxRQUFRLEtBQzNCLGlCQUFpQixLQUFLLFFBQVEsS0FDOUIsZUFBZSxLQUFLLFFBQVE7QUFFOUIsYUFBTyxpQkFBaUIsS0FBSyxRQUFRLEtBQUssQ0FBQztBQUFBLElBQzdDLENBQUM7QUFFRCxXQUFPO0FBQUEsTUFDTCx1QkFBdUIsWUFBWTtBQUFBLE1BQ25DLFNBQVMsWUFBWSxNQUFNLEdBQUcsQ0FBQztBQUFBLElBQ2pDO0FBQUEsRUFDRjtBQUNGOzs7QUM3Qk8sSUFBTSx3QkFBTixNQUFpRDtBQUFBLEVBQWpEO0FBQ0wsU0FBUyxLQUFLO0FBQ2QsU0FBUyxPQUFPO0FBQ2hCLFNBQVMsY0FBYztBQUN2QixTQUFTLGtCQUFrQjtBQUFBO0FBQUEsRUFFM0IsSUFBSSxVQUFzQztBQUN4QyxRQUFJLENBQUMsU0FBUyxZQUFZO0FBQ3hCLGFBQU8sQ0FBQztBQUFBLElBQ1Y7QUFFQSxVQUFNLFNBQVMsSUFBSSxjQUFjLEVBQUUsUUFBUSxTQUFTLFVBQVU7QUFDOUQsUUFBSSxPQUFPLDBCQUEwQixHQUFHO0FBQ3RDLGFBQU8sQ0FBQztBQUFBLElBQ1Y7QUFFQSxXQUFPO0FBQUEsTUFDTDtBQUFBLFFBQ0UsUUFBUSxLQUFLO0FBQUEsUUFDYixVQUFVO0FBQUEsUUFDVixVQUFVO0FBQUEsUUFDVixVQUFVLFNBQVM7QUFBQSxRQUNuQixPQUFPO0FBQUEsUUFDUCxTQUFTLHFCQUFxQixPQUFPLHFCQUFxQjtBQUFBLFFBQzFELFVBQVUsT0FBTztBQUFBLFFBQ2pCLGFBQWE7QUFBQSxNQUNmO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRjs7O0FDdEJPLElBQU0sZUFBTixNQUFtQjtBQUFBLEVBQW5CO0FBQ0wsU0FBaUIsUUFBcUI7QUFBQSxNQUNwQyxJQUFJLFlBQVk7QUFBQSxNQUNoQixJQUFJLGdCQUFnQjtBQUFBLE1BQ3BCLElBQUksZUFBZTtBQUFBLE1BQ25CLElBQUksd0JBQXdCO0FBQUEsTUFDNUIsSUFBSSwwQkFBMEI7QUFBQSxNQUM5QixJQUFJLGFBQWE7QUFBQSxNQUNqQixJQUFJLG1CQUFtQjtBQUFBLE1BQ3ZCLElBQUksc0JBQXNCO0FBQUEsSUFDNUI7QUFBQTtBQUFBLEVBRUEsU0FBUyxVQUE0QztBQUNuRCxXQUFPLEtBQUssTUFBTSxPQUFPLENBQUMsU0FBUyxTQUFTLGFBQWEsU0FBUyxLQUFLLEVBQUUsQ0FBQztBQUFBLEVBQzVFO0FBQ0Y7OztBQ3hCTyxJQUFNLGVBQTRDO0FBQUEsRUFDdkQsWUFBWTtBQUFBLEVBQ1osZ0JBQWdCO0FBQUEsRUFDaEIsZUFBZTtBQUFBLEVBQ2Ysd0JBQXdCO0FBQUEsRUFDeEIsMkJBQTJCO0FBQUEsRUFDM0IsYUFBYTtBQUFBLEVBQ2IsbUJBQW1CO0FBQUEsRUFDbkIsc0JBQXNCO0FBQ3hCO0FBRU8sSUFBTSxzQkFBcUQ7QUFBQSxFQUNoRSxNQUFNO0FBQUEsRUFDTixTQUFTO0FBQUEsRUFDVCxPQUFPO0FBQUEsRUFDUCxVQUFVO0FBQ1o7OztBQ2RBLElBQU0sYUFBK0I7QUFBQSxFQUNuQztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRjtBQUVPLElBQU0scUJBQU4sTUFBeUI7QUFBQSxFQUM5QixVQUFVLFFBQXNCLGNBQTRDO0FBQzFFLFVBQU0sc0JBQXNEO0FBQUEsTUFDMUQsV0FBVztBQUFBLE1BQ1gsT0FBTztBQUFBLE1BQ1AsV0FBVztBQUFBLE1BQ1gsVUFBVTtBQUFBLE1BQ1YscUJBQXFCO0FBQUEsSUFDdkI7QUFFQSxVQUFNLHVCQUF1QjtBQUFBLE1BQzNCLE1BQU07QUFBQSxNQUNOLFNBQVM7QUFBQSxNQUNULE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxJQUNaO0FBRUEsUUFBSSxlQUFlO0FBRW5CLGVBQVcsU0FBUyxRQUFRO0FBQzFCLFlBQU0sa0JBQ0osTUFBTSxjQUNOLGFBQWEsTUFBTSxNQUFNLElBQ3pCLG9CQUFvQixNQUFNLFFBQVE7QUFFcEMsMEJBQW9CLE1BQU0sUUFBUSxLQUFLO0FBQ3ZDLDJCQUFxQixNQUFNLFFBQVEsS0FBSztBQUN4QyxzQkFBZ0I7QUFBQSxJQUNsQjtBQUVBLFVBQU0sb0JBQW9CLGVBQWUsSUFBSyxlQUFlLGVBQWdCLElBQUk7QUFDakYsVUFBTSxRQUFRLEtBQUssSUFBSSxHQUFHLEtBQUssSUFBSSxLQUFLLEtBQUssTUFBTSxNQUFNLGlCQUFpQixDQUFDLENBQUM7QUFFNUUsVUFBTSxhQUFhLE9BQU87QUFBQSxNQUN4QixXQUFXLElBQUksQ0FBQyxhQUFhO0FBQzNCLGNBQU0sa0JBQWtCLGVBQWUsSUFBSyxvQkFBb0IsUUFBUSxJQUFJLGVBQWdCLElBQUk7QUFDaEcsY0FBTSxRQUFRLEtBQUssSUFBSSxHQUFHLEtBQUssSUFBSSxLQUFLLEtBQUssTUFBTSxNQUFNLGVBQWUsQ0FBQyxDQUFDO0FBQzFFLGVBQU8sQ0FBQyxVQUFVLEtBQUs7QUFBQSxNQUN6QixDQUFDO0FBQUEsSUFDSDtBQUVBLFdBQU87QUFBQSxNQUNMO0FBQUEsTUFDQTtBQUFBLE1BQ0EsZUFBZSxPQUFPLGFBQWEsUUFBUSxDQUFDLENBQUM7QUFBQSxNQUM3QztBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0Y7OztBQzVEUSxJQUFNLFlBQU4sTUFBZ0I7QUFBQSxFQUN0QixNQUFNLFFBQXVCO0FBQzNCLFVBQU0sSUFBSSxRQUFjLENBQUMsWUFBWTtBQUNuQyxVQUFJLE9BQU8sMEJBQTBCLFlBQVk7QUFDL0MsOEJBQXNCLE1BQU0sUUFBUSxDQUFDO0FBQ3JDO0FBQUEsTUFDRjtBQUVBLGlCQUFXLE1BQU0sUUFBUSxHQUFHLENBQUM7QUFBQSxJQUMvQixDQUFDO0FBQUEsRUFDSDtBQUNGOzs7QUNYUSxTQUFTLGtCQUFrQixPQUF1QjtBQUN4RCxTQUFPLE1BQU0sUUFBUSxPQUFPLEdBQUcsRUFBRSxLQUFLO0FBQ3hDO0FBRU8sU0FBUyxjQUFjLE1BQWMsZ0JBQW1DO0FBQzdFLFFBQU0sYUFBYSxrQkFBa0IsSUFBSSxFQUFFLFlBQVk7QUFFdkQsU0FBTyxlQUFlLEtBQUssQ0FBQyxXQUFXO0FBQ3JDLFVBQU0sWUFBWSxrQkFBa0IsTUFBTSxFQUFFLFlBQVk7QUFDeEQsV0FBTyxlQUFlLGFBQWEsV0FBVyxXQUFXLEdBQUcsU0FBUyxHQUFHO0FBQUEsRUFDMUUsQ0FBQztBQUNIOzs7QUNYUSxTQUFTLFdBQWMsT0FBWSxNQUFxQjtBQUM5RCxNQUFJLFFBQVEsR0FBRztBQUNiLFdBQU8sQ0FBQyxLQUFLO0FBQUEsRUFDZjtBQUVBLFFBQU0sU0FBZ0IsQ0FBQztBQUN2QixXQUFTLFFBQVEsR0FBRyxRQUFRLE1BQU0sUUFBUSxTQUFTLE1BQU07QUFDdkQsV0FBTyxLQUFLLE1BQU0sTUFBTSxPQUFPLFFBQVEsSUFBSSxDQUFDO0FBQUEsRUFDOUM7QUFFQSxTQUFPO0FBQ1Q7OztBQ0tPLElBQU0sY0FBTixNQUFrQjtBQUFBLEVBQ3ZCLFlBQ21CLEtBQ0EsaUJBQ0EsY0FDQSxjQUNBLFlBQ0EsV0FDQSxrQkFDQSxZQUNqQjtBQVJpQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQUEsRUFDaEI7QUFBQSxFQUVILE1BQU0sZUFBMEM7QUFDOUMsVUFBTSxXQUFXLEtBQUssaUJBQWlCO0FBQ3ZDLFVBQU0sUUFBUSxLQUFLLGlCQUFpQixRQUFRO0FBQzVDLFVBQU0sUUFBUSxLQUFLLFdBQVcsS0FBSztBQUNuQyxVQUFNLFNBQVMsTUFBTSxLQUFLLElBQUksT0FBTyxLQUFLO0FBQzFDLFVBQU0sS0FBSyxXQUFXLFdBQVcsTUFBTTtBQUN2QyxXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsTUFBTSxvQkFBb0IsT0FBNEM7QUFyQ3hFO0FBc0NJLFVBQU0sV0FBVyxLQUFLLGlCQUFpQjtBQUN2QyxVQUFNLGdCQUFnQixLQUFLLGlCQUFpQixRQUFRO0FBQ3BELFVBQU0sV0FBVyxJQUFJLElBQUksS0FBSztBQUM5QixVQUFNLFFBQVEsY0FBYyxPQUFPLENBQUMsU0FBUyxTQUFTLElBQUksS0FBSyxJQUFJLENBQUM7QUFFcEUsUUFBSSxNQUFNLFdBQVcsR0FBRztBQUN0QixZQUFNLGFBQWEsTUFBTSxLQUFLLFdBQVcsY0FBYztBQUN2RCxhQUNFLGtDQUFjO0FBQUEsUUFDWixXQUFXLEtBQUssSUFBSTtBQUFBLFFBQ3BCLFlBQVksS0FBSyxJQUFJO0FBQUEsUUFDckIsY0FBYztBQUFBLFFBQ2QsUUFBUSxDQUFDO0FBQUEsUUFDVCxXQUFXLEtBQUssYUFBYSxVQUFVLENBQUMsR0FBRyxDQUFDO0FBQUEsUUFDNUMsY0FBYyxDQUFDO0FBQUEsTUFDakI7QUFBQSxJQUVKO0FBRUEsVUFBTSxRQUFRLEtBQUssV0FBVyxhQUFhO0FBQzNDLFVBQU0sZ0JBQWdCLE1BQU0sS0FBSyxJQUFJLE9BQU8sS0FBSztBQUNqRCxVQUFNLFdBQVcsTUFBTSxLQUFLLFdBQVcsY0FBYztBQUVyRCxVQUFNLGVBQWUsS0FBSyxhQUFZLDBDQUFVLFdBQVYsWUFBb0IsQ0FBQyxHQUFHLGNBQWMsUUFBUSxNQUFNLElBQUksQ0FBQyxTQUFTLEtBQUssSUFBSSxDQUFDO0FBQ2xILFVBQU0sZUFBaUM7QUFBQSxNQUNyQyxXQUFXLGNBQWM7QUFBQSxNQUN6QixZQUFZLGNBQWM7QUFBQSxNQUMxQixlQUFjLDBDQUFVLGlCQUFWLFlBQTBCLGNBQWM7QUFBQSxNQUN0RCxRQUFRO0FBQUEsTUFDUixXQUFXLEtBQUssYUFBYSxVQUFVLGVBQWMsMENBQVUsaUJBQVYsWUFBMEIsY0FBYyxNQUFNO0FBQUEsTUFDbkcsY0FBYyxLQUFLLG9CQUFvQixZQUFZO0FBQUEsSUFDckQ7QUFFQSxVQUFNLEtBQUssV0FBVyxXQUFXLFlBQVk7QUFDN0MsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUVRLGlCQUFpQixVQUF3QztBQUMvRCxXQUFPLEtBQUssSUFBSSxNQUNiLGlCQUFpQixFQUNqQixPQUFPLENBQUMsU0FBUyxDQUFDLGNBQWMsS0FBSyxNQUFNLFNBQVMsY0FBYyxDQUFDO0FBQUEsRUFDeEU7QUFBQSxFQUVRLFdBQVcsT0FBNEI7QUFqRmpEO0FBa0ZJLFVBQU0sVUFBa0MsQ0FBQztBQUN6QyxVQUFNLFdBQW1DLENBQUM7QUFDMUMsVUFBTSxXQUFXLG9CQUFJLElBQVk7QUFFakMsZUFBVyxRQUFRLE9BQU87QUFDeEIsZUFBUyxJQUFJLEtBQUssSUFBSTtBQUN0QixZQUFNLFFBQVEsS0FBSyxJQUFJLGNBQWMsYUFBYSxJQUFJO0FBQ3RELFlBQU0sU0FBUSwwQ0FBTyxVQUFQLG1CQUFjLElBQUksQ0FBQyxTQUFTLEtBQUssVUFBakMsWUFBMEMsQ0FBQztBQUN6RCxlQUFTLEtBQUssSUFBSSxJQUFJLE1BQU07QUFFNUIsaUJBQVcsUUFBUSxPQUFPO0FBQ3hCLGNBQU0sY0FBYyxLQUFLLElBQUksY0FBYyxxQkFBcUIsTUFBTSxLQUFLLElBQUk7QUFDL0UsWUFBSSxhQUFhO0FBQ2Ysa0JBQVEsWUFBWSxJQUFJLE1BQUssYUFBUSxZQUFZLElBQUksTUFBeEIsWUFBNkIsS0FBSztBQUFBLFFBQ2pFO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFFQSxXQUFPLEVBQUUsVUFBVSxTQUFTLFNBQVM7QUFBQSxFQUN2QztBQUFBLEVBRUEsTUFBYyxJQUFJLE9BQWdCLE9BQThDO0FBdkdsRjtBQXdHSSxVQUFNLFdBQVcsS0FBSyxpQkFBaUI7QUFDdkMsVUFBTSxZQUFZLEtBQUssSUFBSTtBQUMzQixVQUFNLFNBQXVCLENBQUM7QUFDOUIsVUFBTSxRQUFRLEtBQUssYUFBYSxTQUFTLFFBQVE7QUFDakQsVUFBTSxnQkFBZ0IsTUFBTSxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssZUFBZTtBQUNsRSxVQUFNLGVBQWUsTUFBTSxPQUFPLENBQUMsU0FBUyxLQUFLLGVBQWU7QUFDaEUsUUFBSSxVQUFVO0FBRWQsZUFBVyxTQUFTLFdBQVcsT0FBTyxTQUFTLFNBQVMsR0FBRztBQUN6RCxpQkFBVyxRQUFRLE9BQU87QUFDeEIsY0FBTSxtQkFBbUIsTUFBTSxLQUFLLGdCQUFnQixNQUFNLE1BQU0sT0FBTyxLQUFLO0FBRTVFLFlBQUksS0FBSyxjQUFjLGlCQUFpQixNQUFNLFNBQVMsV0FBVyxHQUFHO0FBQ25FLHFCQUFXO0FBQ1g7QUFBQSxRQUNGO0FBRUEsbUJBQVcsUUFBUSxlQUFlO0FBQ2hDLGdCQUFNLGFBQWEsTUFBTSxLQUFLLElBQUksa0JBQWtCO0FBQUEsWUFDbEQsS0FBSyxLQUFLLElBQUk7QUFBQSxZQUNkO0FBQUEsWUFDQTtBQUFBLFVBQ0YsQ0FBQztBQUNELGlCQUFPLEtBQUssR0FBRyxVQUFVO0FBQUEsUUFDM0I7QUFFQSxZQUFJLGFBQWEsU0FBUyxHQUFHO0FBQzNCLGdCQUFNLGVBQWUsTUFBTSxLQUFLLGdCQUFnQixNQUFNLE1BQU0sT0FBTyxJQUFJO0FBQ3ZFLHFCQUFXLFFBQVEsY0FBYztBQUMvQixrQkFBTSxhQUFhLE1BQU0sS0FBSyxJQUFJLGNBQWM7QUFBQSxjQUM5QyxLQUFLLEtBQUssSUFBSTtBQUFBLGNBQ2Q7QUFBQSxjQUNBO0FBQUEsWUFDRixDQUFDO0FBQ0QsbUJBQU8sS0FBSyxHQUFHLFVBQVU7QUFBQSxVQUMzQjtBQUFBLFFBQ0Y7QUFFQSxtQkFBVztBQUFBLE1BQ2I7QUFFQSxpQkFBSyxlQUFMLDhCQUFrQjtBQUFBLFFBQ2hCO0FBQUEsUUFDQSxPQUFPLE1BQU07QUFBQSxNQUNmO0FBRUEsWUFBTSxLQUFLLFVBQVUsTUFBTTtBQUFBLElBQzdCO0FBRUEsV0FBTztBQUFBLE1BQ0w7QUFBQSxNQUNBLFlBQVksS0FBSyxJQUFJO0FBQUEsTUFDckIsY0FBYyxNQUFNO0FBQUEsTUFDcEI7QUFBQSxNQUNBLFdBQVcsS0FBSyxhQUFhLFVBQVUsUUFBUSxNQUFNLE1BQU07QUFBQSxNQUMzRCxjQUFjLEtBQUssb0JBQW9CLE1BQU07QUFBQSxJQUMvQztBQUFBLEVBQ0Y7QUFBQSxFQUVRLGNBQWMsTUFBZ0IsYUFBZ0M7QUFDcEUsVUFBTSxpQkFBaUIsSUFBSSxJQUFJLEtBQUssSUFBSSxDQUFDLFFBQVEsSUFBSSxZQUFZLENBQUMsQ0FBQztBQUNuRSxXQUFPLFlBQVksS0FBSyxDQUFDLFFBQVEsZUFBZSxJQUFJLElBQUksWUFBWSxDQUFDLENBQUM7QUFBQSxFQUN4RTtBQUFBLEVBRVEsWUFBWSxVQUF3QixVQUF3QixjQUFzQztBQUN4RyxVQUFNLFVBQVUsSUFBSSxJQUFJLFlBQVk7QUFDcEMsV0FBTyxDQUFDLEdBQUcsU0FBUyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsSUFBSSxNQUFNLFFBQVEsQ0FBQyxHQUFHLEdBQUcsUUFBUTtBQUFBLEVBQ2xGO0FBQUEsRUFFUSxvQkFBb0IsUUFBc0I7QUE3S3BEO0FBOEtJLFVBQU0sVUFBVSxvQkFBSSxJQUFvRDtBQUV4RSxlQUFXLFNBQVMsUUFBUTtBQUMxQixZQUFNLFdBQVUsYUFBUSxJQUFJLE1BQU0sUUFBUSxNQUExQixZQUErQixFQUFFLFFBQVEsR0FBRyxZQUFZLEVBQUU7QUFDMUUsY0FBUSxVQUFVLE1BQU07QUFDeEIsY0FBUSxjQUFjO0FBQ3RCLGNBQVEsSUFBSSxNQUFNLFVBQVUsT0FBTztBQUFBLElBQ3JDO0FBRUEsV0FBTyxNQUFNLEtBQUssUUFBUSxRQUFRLENBQUMsRUFDaEMsSUFBSSxDQUFDLENBQUMsTUFBTSxPQUFPLE9BQU87QUFBQSxNQUN6QjtBQUFBLE1BQ0EsUUFBUSxRQUFRO0FBQUEsTUFDaEIsWUFBWSxRQUFRO0FBQUEsSUFDdEIsRUFBRSxFQUNELEtBQUssQ0FBQyxNQUFNLFVBQVUsTUFBTSxTQUFTLEtBQUssVUFBVSxNQUFNLGFBQWEsS0FBSyxVQUFVLEVBQ3RGLE1BQU0sR0FBRyxFQUFFO0FBQUEsRUFDaEI7QUFDRjs7O0FDaE1DLHNCQUF3QztBQUlsQyxJQUFNLGdCQUFOLGNBQTRCLHlCQUFTO0FBQUEsRUFDMUMsWUFDRSxNQUNpQixRQUNqQjtBQUNBLFVBQU0sSUFBSTtBQUZPO0FBQUEsRUFHbkI7QUFBQSxFQUVBLGNBQXNCO0FBQ3BCLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFQSxpQkFBeUI7QUFDdkIsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUVBLFVBQWtCO0FBQ2hCLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFQSxNQUFNLFNBQXdCO0FBQzVCLFVBQU0sS0FBSyxPQUFPO0FBQUEsRUFDcEI7QUFBQSxFQUVBLE1BQU0sU0FBd0I7QUE1QmhDO0FBNkJJLFVBQU0sU0FBUyxNQUFNLEtBQUssT0FBTyxXQUFXLGNBQWM7QUFDMUQsVUFBTSxVQUFVLE1BQU0sS0FBSyxPQUFPLFdBQVcsV0FBVztBQUV4RCxTQUFLLFVBQVUsTUFBTTtBQUNyQixTQUFLLFVBQVUsU0FBUyxlQUFlO0FBRXZDLFVBQU0sU0FBUyxLQUFLLFVBQVUsVUFBVSxFQUFFLEtBQUssYUFBYSxDQUFDO0FBQzdELFdBQU8sU0FBUyxNQUFNLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUV0RCxVQUFNLFlBQVksT0FBTyxVQUFVLEVBQUUsS0FBSyxjQUFjLENBQUM7QUFDekQsVUFBTSxrQkFBa0IsVUFBVSxTQUFTLFVBQVU7QUFBQSxNQUNuRCxNQUFNO0FBQUEsTUFDTixLQUFLO0FBQUEsSUFDUCxDQUFDO0FBQ0Qsb0JBQWdCLGlCQUFpQixTQUFTLFlBQVk7QUFDcEQsWUFBTSxLQUFLLE9BQU8sYUFBYTtBQUMvQixZQUFNLEtBQUssT0FBTztBQUFBLElBQ3BCLENBQUM7QUFFRCxVQUFNLG9CQUFvQixVQUFVLFNBQVMsVUFBVTtBQUFBLE1BQ3JELE1BQU07QUFBQSxJQUNSLENBQUM7QUFDRCxzQkFBa0IsaUJBQWlCLFNBQVMsWUFBWTtBQUN0RCxZQUFNLEtBQUssT0FBTyxvQkFBb0I7QUFDdEMsWUFBTSxLQUFLLE9BQU87QUFBQSxJQUNwQixDQUFDO0FBRUQsUUFBSSxDQUFDLFFBQVE7QUFDWCxXQUFLLFVBQVUsU0FBUyxLQUFLO0FBQUEsUUFDM0IsTUFBTTtBQUFBLE1BQ1IsQ0FBQztBQUNEO0FBQUEsSUFDRjtBQUVBLFVBQU0sUUFBUSxLQUFLLFVBQVUsVUFBVSxFQUFFLEtBQUssWUFBWSxDQUFDO0FBQzNELFNBQUssV0FBVyxPQUFPLGdCQUFnQixPQUFPLE9BQU8sVUFBVSxLQUFLLENBQUM7QUFDckUsU0FBSyxXQUFXLE9BQU8saUJBQWlCLE9BQU8sT0FBTyxZQUFZLENBQUM7QUFDbkUsU0FBSyxXQUFXLE9BQU8sZ0JBQWdCLE9BQU8sT0FBTyxPQUFPLE1BQU0sQ0FBQztBQUNuRSxTQUFLLFdBQVcsT0FBTyxZQUFZLEdBQUcsS0FBSyxPQUFPLFNBQVMsT0FBTyxJQUFJLEtBQUssT0FBTyxTQUFTLEtBQUssRUFBRTtBQUVsRyxVQUFNLGdCQUFnQixLQUFLLFVBQVUsVUFBVSxFQUFFLEtBQUssWUFBWSxDQUFDO0FBQ25FLGtCQUFjLFNBQVMsTUFBTSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDM0Qsa0JBQWMsU0FBUyxPQUFPO0FBQUEsTUFDNUIsTUFBTSxLQUFLLFVBQVUsT0FBTyxVQUFVLHNCQUFzQixNQUFNLENBQUM7QUFBQSxJQUNyRSxDQUFDO0FBRUQsVUFBTSxnQkFBZ0IsS0FBSyxVQUFVLFVBQVUsRUFBRSxLQUFLLFlBQVksQ0FBQztBQUNuRSxrQkFBYyxTQUFTLE1BQU0sRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ3hELGtCQUFjLFNBQVMsT0FBTztBQUFBLE1BQzVCLE1BQU0sS0FBSyxVQUFVLE9BQU8sVUFBVSxZQUFZLE1BQU0sQ0FBQztBQUFBLElBQzNELENBQUM7QUFFRCxVQUFNLGlCQUFpQixLQUFLLFVBQVUsVUFBVSxFQUFFLEtBQUssWUFBWSxDQUFDO0FBQ3BFLG1CQUFlLFNBQVMsTUFBTSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDdkQsUUFBSSxPQUFPLGFBQWEsV0FBVyxHQUFHO0FBQ3BDLHFCQUFlLFNBQVMsS0FBSyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFBQSxJQUM5RSxPQUFPO0FBQ0wsWUFBTSxnQkFBZ0IsZUFBZSxTQUFTLElBQUk7QUFDbEQsaUJBQVcsWUFBWSxPQUFPLGNBQWM7QUFDMUMsc0JBQWMsU0FBUyxNQUFNO0FBQUEsVUFDM0IsTUFBTSxHQUFHLFNBQVMsSUFBSSw0QkFBZSxTQUFTLE1BQU0sTUFBTSxTQUFTLFVBQVU7QUFBQSxRQUMvRSxDQUFDO0FBQUEsTUFDSDtBQUFBLElBQ0Y7QUFFQSxVQUFNLGNBQWMsS0FBSyxVQUFVLFVBQVUsRUFBRSxLQUFLLFlBQVksQ0FBQztBQUNqRSxnQkFBWSxTQUFTLE1BQU0sRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ3BELFFBQUksT0FBTyxPQUFPLFdBQVcsR0FBRztBQUM5QixrQkFBWSxTQUFTLEtBQUssRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQUEsSUFDakUsT0FBTztBQUNMLFlBQU0sYUFBYSxZQUFZLFVBQVUsRUFBRSxLQUFLLGFBQWEsQ0FBQztBQUM5RCxpQkFBVyxTQUFTLE9BQU8sT0FBTyxNQUFNLEdBQUcsRUFBRSxHQUFHO0FBQzlDLGNBQU0sT0FBTyxXQUFXLFVBQVUsRUFBRSxLQUFLLGlCQUFpQixNQUFNLFFBQVEsR0FBRyxDQUFDO0FBQzVFLGFBQUssU0FBUyxVQUFVLEVBQUUsTUFBTSxJQUFJLE1BQU0sU0FBUyxZQUFZLENBQUMsS0FBSyxNQUFNLEtBQUssR0FBRyxDQUFDO0FBQ3BGLGFBQUssU0FBUyxPQUFPLEVBQUUsTUFBTSxNQUFNLFNBQVMsQ0FBQztBQUM3QyxhQUFLLFNBQVMsS0FBSyxFQUFFLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFFMUMsYUFBSSxXQUFNLGFBQU4sbUJBQWdCLFFBQVE7QUFDMUIsZUFBSyxTQUFTLE9BQU8sRUFBRSxNQUFNLE1BQU0sU0FBUyxLQUFLLElBQUksRUFBRSxDQUFDO0FBQUEsUUFDMUQ7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUVBLFVBQU0sZUFBZSxLQUFLLFVBQVUsVUFBVSxFQUFFLEtBQUssWUFBWSxDQUFDO0FBQ2xFLGlCQUFhLFNBQVMsTUFBTSxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQy9DLFFBQUksUUFBUSxXQUFXLEdBQUc7QUFDeEIsbUJBQWEsU0FBUyxLQUFLLEVBQUUsTUFBTSwwREFBd0MsQ0FBQztBQUFBLElBQzlFLE9BQU87QUFDTCxZQUFNLGNBQWMsYUFBYSxTQUFTLElBQUk7QUFDOUMsaUJBQVcsU0FBUyxRQUFRLE1BQU0sR0FBRyxFQUFFLFFBQVEsR0FBRztBQUNoRCxvQkFBWSxTQUFTLE1BQU07QUFBQSxVQUN6QixNQUFNLEdBQUcsSUFBSSxLQUFLLE1BQU0sU0FBUyxFQUFFLGVBQWUsQ0FBQywyQkFBYyxNQUFNLEtBQUssWUFBWSxNQUFNLFVBQVUsV0FBVyxNQUFNLFlBQVk7QUFBQSxRQUN2SSxDQUFDO0FBQUEsTUFDSDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFUSxXQUFXLFdBQXdCLE9BQWUsT0FBcUI7QUFDN0UsVUFBTSxPQUFPLFVBQVUsVUFBVSxFQUFFLEtBQUssV0FBVyxDQUFDO0FBQ3BELFNBQUssU0FBUyxTQUFTLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDdEMsU0FBSyxTQUFTLE1BQU0sRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUFBLEVBQ3JDO0FBQ0Y7OztBQ25JQyxJQUFBQyxtQkFBdUQ7QUFHakQsSUFBTSx3QkFBTixjQUFvQyxrQ0FBaUI7QUFBQSxFQUMxRCxZQUNFLEtBQ2lCLFFBQ2pCO0FBQ0EsVUFBTSxLQUFLLE1BQU07QUFGQTtBQUFBLEVBR25CO0FBQUEsRUFFQSxVQUFnQjtBQUNkLFVBQU0sRUFBRSxZQUFZLElBQUk7QUFDeEIsZ0JBQVksTUFBTTtBQUVsQixnQkFBWSxTQUFTLE1BQU0sRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRXBFLFFBQUkseUJBQVEsV0FBVyxFQUNwQixRQUFRLDJCQUEyQixFQUNuQyxRQUFRLCtEQUErRCxFQUN2RTtBQUFBLE1BQVUsQ0FBQyxXQUNWLE9BQ0csU0FBUyxLQUFLLE9BQU8sU0FBUyxrQkFBa0IsRUFDaEQsU0FBUyxPQUFPLFVBQVU7QUFDekIsYUFBSyxPQUFPLFNBQVMscUJBQXFCO0FBQzFDLGNBQU0sS0FBSyxPQUFPLG1CQUFtQjtBQUFBLE1BQ3ZDLENBQUM7QUFBQSxJQUNMO0FBRUYsUUFBSSx5QkFBUSxXQUFXLEVBQ3BCLFFBQVEscUJBQXFCLEVBQzdCLFFBQVEsa0ZBQTRFLEVBQ3BGO0FBQUEsTUFBUSxDQUFDLFNBQ1IsS0FDRyxlQUFlLGFBQWEsRUFDNUIsU0FBUyxLQUFLLE9BQU8sU0FBUyxpQkFBaUIsRUFDL0MsU0FBUyxPQUFPLFVBQVU7QUFDekIsYUFBSyxPQUFPLFNBQVMsb0JBQW9CLE1BQU0sS0FBSyxLQUFLO0FBQ3pELGNBQU0sS0FBSyxPQUFPLG1CQUFtQjtBQUFBLE1BQ3ZDLENBQUM7QUFBQSxJQUNMO0FBRUYsUUFBSSx5QkFBUSxXQUFXLEVBQ3BCLFFBQVEsWUFBWSxFQUNwQixRQUFRLDJDQUEyQyxFQUNuRDtBQUFBLE1BQVEsQ0FBQyxTQUNSLEtBQ0csU0FBUyxPQUFPLEtBQUssT0FBTyxTQUFTLFNBQVMsQ0FBQyxFQUMvQyxTQUFTLE9BQU8sVUFBVTtBQUN6QixjQUFNLFNBQVMsT0FBTyxLQUFLO0FBQzNCLFlBQUksT0FBTyxTQUFTLE1BQU0sS0FBSyxTQUFTLEdBQUc7QUFDekMsZUFBSyxPQUFPLFNBQVMsWUFBWTtBQUNqQyxnQkFBTSxLQUFLLE9BQU8sbUJBQW1CO0FBQUEsUUFDdkM7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNMO0FBRUYsUUFBSSx5QkFBUSxXQUFXLEVBQ3BCLFFBQVEsc0JBQXNCLEVBQzlCLFFBQVEseUVBQW1FLEVBQzNFO0FBQUEsTUFBUSxDQUFDLFNBQ1IsS0FDRyxTQUFTLE9BQU8sS0FBSyxPQUFPLFNBQVMsc0JBQXNCLENBQUMsRUFDNUQsU0FBUyxPQUFPLFVBQVU7QUFDekIsY0FBTSxTQUFTLE9BQU8sS0FBSztBQUMzQixZQUFJLE9BQU8sU0FBUyxNQUFNLEtBQUssU0FBUyxHQUFHO0FBQ3pDLGVBQUssT0FBTyxTQUFTLHlCQUF5QjtBQUM5QyxnQkFBTSxLQUFLLE9BQU8sbUJBQW1CO0FBQUEsUUFDdkM7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNMO0FBRUYsUUFBSSx5QkFBUSxXQUFXLEVBQ3BCLFFBQVEsMkJBQTJCLEVBQ25DLFFBQVEscURBQStDLEVBQ3ZEO0FBQUEsTUFBWSxDQUFDLFNBQ1osS0FDRyxlQUFlLElBQUksRUFDbkIsU0FBUyxLQUFLLFVBQVUsS0FBSyxPQUFPLFNBQVMsa0JBQWtCLE1BQU0sQ0FBQyxDQUFDLEVBQ3ZFLFNBQVMsT0FBTyxVQUFVO0FBQ3pCLFlBQUk7QUFDRixnQkFBTSxTQUFTLEtBQUssTUFBTSxLQUFLO0FBQy9CLGNBQUksQ0FBQyxNQUFNLFFBQVEsTUFBTSxHQUFHO0FBQzFCLGtCQUFNLElBQUksTUFBTSxvQ0FBb0M7QUFBQSxVQUN0RDtBQUVBLGVBQUssT0FBTyxTQUFTLG1CQUFtQjtBQUN4QyxnQkFBTSxLQUFLLE9BQU8sbUJBQW1CO0FBQUEsUUFDdkMsU0FBUyxPQUFPO0FBQ2QsY0FBSSx3QkFBTyw2Q0FBdUMsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUFBLFFBQ25FO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDTDtBQUFBLEVBQ0o7QUFDRjs7O0FDOUZRLElBQU0scUJBQU4sTUFBeUI7QUFBQSxFQUF6QjtBQUNOLFNBQWlCLGFBQWEsb0JBQUksSUFBWTtBQUFBO0FBQUEsRUFFOUMsVUFBVSxNQUFvQjtBQUM1QixTQUFLLFdBQVcsSUFBSSxJQUFJO0FBQUEsRUFDMUI7QUFBQSxFQUVBLFlBQVksTUFBb0I7QUFDOUIsU0FBSyxXQUFXLElBQUksSUFBSTtBQUFBLEVBQzFCO0FBQUEsRUFFQSxRQUFjO0FBQ1osU0FBSyxXQUFXLE1BQU07QUFBQSxFQUN4QjtBQUFBLEVBRUEsZUFBeUI7QUFDdkIsVUFBTSxRQUFRLE1BQU0sS0FBSyxLQUFLLFVBQVU7QUFDeEMsU0FBSyxXQUFXLE1BQU07QUFDdEIsV0FBTztBQUFBLEVBQ1Q7QUFDRjs7O0FDbEJBLGVBQXNCLGNBQWMsUUFBaUQ7QUFDbkYsUUFBTSxPQUFPLG9CQUFvQjtBQUNuQzs7O0FDRkEsZUFBc0Isb0JBQW9CLFFBQWlEO0FBQ3pGLFFBQU0sT0FBTyxhQUFhO0FBQzVCOzs7QUNGQSxlQUFzQiwyQkFBMkIsUUFBaUQ7QUFDaEcsUUFBTSxPQUFPLG9CQUFvQjtBQUNuQzs7O0FDSlEsSUFBTSxTQUFTO0FBQUEsRUFDckIsTUFBTSxJQUFJLFNBQW9CLFFBQVEsS0FBSyx3QkFBd0IsR0FBRyxJQUFJO0FBQUEsRUFDMUUsTUFBTSxJQUFJLFNBQW9CLFFBQVEsS0FBSyx3QkFBd0IsR0FBRyxJQUFJO0FBQUEsRUFDMUUsT0FBTyxJQUFJLFNBQW9CLFFBQVEsTUFBTSx3QkFBd0IsR0FBRyxJQUFJO0FBQzlFOzs7QWpDZ0JBLElBQXFCLDJCQUFyQixjQUFzRCx3QkFBTztBQUFBLEVBQTdEO0FBQUE7QUFDRSxvQkFBZ0M7QUFFaEMsb0JBQVcsRUFBRSxTQUFTLEdBQUcsT0FBTyxFQUFFO0FBRWxDLFNBQWlCLFVBQVUsSUFBSSxtQkFBbUI7QUFFbEQsU0FBUSxVQUFVO0FBQUE7QUFBQSxFQUVsQixNQUFNLFNBQXdCO0FBQzVCLFdBQU8sS0FBSyxnQkFBZ0I7QUFFNUIsU0FBSyxhQUFhLElBQUksZ0JBQWdCLElBQUk7QUFDMUMsU0FBSyxXQUFXLE1BQU0sS0FBSyxXQUFXLFlBQVksZ0JBQWdCO0FBQ2xFLFNBQUssU0FBUyxLQUFLLGFBQWE7QUFFaEMsU0FBSztBQUFBLE1BQ0g7QUFBQSxNQUNBLENBQUMsU0FBUyxJQUFJLGNBQWMsTUFBTSxJQUFJO0FBQUEsSUFDeEM7QUFFQSxTQUFLLGNBQWMsSUFBSSxzQkFBc0IsS0FBSyxLQUFLLElBQUksQ0FBQztBQUU1RCxTQUFLLFdBQVc7QUFBQSxNQUNkLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLFVBQVUsTUFBTSxjQUFjLElBQUk7QUFBQSxJQUNwQyxDQUFDO0FBRUQsU0FBSyxXQUFXO0FBQUEsTUFDZCxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixVQUFVLE1BQU0sb0JBQW9CLElBQUk7QUFBQSxJQUMxQyxDQUFDO0FBRUQsU0FBSyxXQUFXO0FBQUEsTUFDZCxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixVQUFVLE1BQU0sMkJBQTJCLElBQUk7QUFBQSxJQUNqRCxDQUFDO0FBRUQsU0FBSyxvQkFBb0I7QUFFekIsU0FBSyxJQUFJLFVBQVUsY0FBYyxZQUFZO0FBQzNDLFVBQUksS0FBSyxTQUFTLG9CQUFvQjtBQUNwQyxjQUFNLEtBQUssYUFBYTtBQUFBLE1BQzFCO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRUEsV0FBaUI7QUFDZixXQUFPLEtBQUssa0JBQWtCO0FBQzlCLFNBQUssSUFBSSxVQUFVLG1CQUFtQixtQkFBbUI7QUFBQSxFQUMzRDtBQUFBLEVBRUEsTUFBTSxxQkFBb0M7QUFDeEMsVUFBTSxLQUFLLFdBQVcsYUFBYSxLQUFLLFFBQVE7QUFDaEQsU0FBSyxTQUFTLEtBQUssYUFBYTtBQUNoQyxVQUFNLEtBQUssc0JBQXNCO0FBQUEsRUFDbkM7QUFBQSxFQUVBLE1BQU0sc0JBQXFDO0FBQ3pDLFVBQU0sU0FBUyxLQUFLLElBQUksVUFBVSxnQkFBZ0IsbUJBQW1CO0FBQ3JFLFFBQUksT0FBTyxPQUFPLENBQUM7QUFFbkIsUUFBSSxDQUFDLE1BQU07QUFDVCxZQUFNLFVBQVUsS0FBSyxJQUFJLFVBQVUsYUFBYSxLQUFLO0FBRXJELFVBQUksQ0FBQyxTQUFTO0FBQ1osWUFBSSx3QkFBTywyQ0FBcUM7QUFDaEQ7QUFBQSxNQUNGO0FBRUEsYUFBTztBQUVQLFlBQU0sS0FBSyxhQUFhO0FBQUEsUUFDdEIsTUFBTTtBQUFBLFFBQ04sUUFBUTtBQUFBLE1BQ1YsQ0FBQztBQUFBLElBQ0g7QUFFQSxTQUFLLElBQUksVUFBVSxXQUFXLElBQUk7QUFBQSxFQUNwQztBQUFBLEVBRUEsTUFBTSxlQUE4QjtBQUNsQyxRQUFJLEtBQUssU0FBUztBQUNoQixVQUFJLHdCQUFPLGdFQUF3QztBQUNuRDtBQUFBLElBQ0Y7QUFFQSxRQUFJO0FBQ0YsV0FBSyxVQUFVO0FBQ2YsV0FBSyxXQUFXLEVBQUUsU0FBUyxHQUFHLE9BQU8sRUFBRTtBQUN2QyxVQUFJLHdCQUFPLDBCQUEwQjtBQUVyQyxZQUFNLFNBQVMsTUFBTSxLQUFLLE9BQU8sYUFBYTtBQUM5QyxZQUFNLEtBQUssc0JBQXNCO0FBRWpDLFVBQUksd0JBQU8sc0NBQWdDLE9BQU8sVUFBVSxLQUFLLGFBQWEsT0FBTyxPQUFPLE1BQU0sR0FBRztBQUFBLElBQ3ZHLFNBQVMsT0FBTztBQUNkLGFBQU8sTUFBTSxLQUFLO0FBQ2xCLFVBQUksd0JBQU8sNEJBQTRCLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFBQSxJQUN4RCxVQUFFO0FBQ0EsV0FBSyxVQUFVO0FBQUEsSUFDakI7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFNLHNCQUFxQztBQUN6QyxRQUFJLEtBQUssU0FBUztBQUNoQixVQUFJLHdCQUFPLGdFQUF3QztBQUNuRDtBQUFBLElBQ0Y7QUFFQSxVQUFNLGFBQWEsS0FBSyxRQUFRLGFBQWE7QUFDN0MsUUFBSSxXQUFXLFdBQVcsR0FBRztBQUMzQixVQUFJLHdCQUFPLHNGQUFvRTtBQUMvRTtBQUFBLElBQ0Y7QUFFQSxRQUFJO0FBQ0YsV0FBSyxVQUFVO0FBQ2YsV0FBSyxXQUFXLEVBQUUsU0FBUyxHQUFHLE9BQU8sV0FBVyxPQUFPO0FBQ3ZELFVBQUksd0JBQU8sbUNBQW1DLFdBQVcsTUFBTSxhQUFhO0FBRTVFLFlBQU0sU0FBUyxNQUFNLEtBQUssT0FBTyxvQkFBb0IsVUFBVTtBQUMvRCxZQUFNLEtBQUssc0JBQXNCO0FBRWpDLFVBQUksd0JBQU8sb0RBQThDLE9BQU8sVUFBVSxLQUFLLEdBQUc7QUFBQSxJQUNwRixTQUFTLE9BQU87QUFDZCxhQUFPLE1BQU0sS0FBSztBQUNsQixVQUFJLHdCQUFPLG1DQUFtQyxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQUEsSUFDL0QsVUFBRTtBQUNBLFdBQUssVUFBVTtBQUFBLElBQ2pCO0FBQUEsRUFDRjtBQUFBLEVBRVEsZUFBNEI7QUFDbEMsV0FBTyxJQUFJO0FBQUEsTUFDVCxLQUFLO0FBQUEsTUFDTCxJQUFJLGdCQUFnQixLQUFLLEtBQUssTUFBTSxLQUFLLFFBQVE7QUFBQSxNQUNqRCxJQUFJLGFBQWE7QUFBQSxNQUNqQixJQUFJLG1CQUFtQjtBQUFBLE1BQ3ZCLEtBQUs7QUFBQSxNQUNMLElBQUksVUFBVTtBQUFBLE1BQ2QsTUFBTSxLQUFLO0FBQUEsTUFDWCxDQUFDLGFBQWE7QUFDWixhQUFLLFdBQVc7QUFDaEIsYUFBSyxLQUFLLHNCQUFzQjtBQUFBLE1BQ2xDO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUVRLHNCQUE0QjtBQUNsQyxTQUFLO0FBQUEsTUFDSCxLQUFLLElBQUksTUFBTSxHQUFHLFVBQVUsQ0FBQyxTQUFTO0FBQ3BDLFlBQUksZ0JBQWdCLDBCQUFTLEtBQUssY0FBYyxNQUFNO0FBQ3BELGVBQUssUUFBUSxVQUFVLEtBQUssSUFBSTtBQUFBLFFBQ2xDO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDtBQUVBLFNBQUs7QUFBQSxNQUNILEtBQUssSUFBSSxNQUFNLEdBQUcsVUFBVSxDQUFDLFNBQVM7QUFDcEMsWUFBSSxnQkFBZ0IsMEJBQVMsS0FBSyxjQUFjLE1BQU07QUFDcEQsZUFBSyxRQUFRLFVBQVUsS0FBSyxJQUFJO0FBQUEsUUFDbEM7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBRUEsU0FBSztBQUFBLE1BQ0gsS0FBSyxJQUFJLE1BQU0sR0FBRyxVQUFVLENBQUMsTUFBTSxZQUFZO0FBQzdDLFlBQUksZ0JBQWdCLDBCQUFTLEtBQUssY0FBYyxNQUFNO0FBQ3BELGVBQUssUUFBUSxVQUFVLEtBQUssSUFBSTtBQUNoQyxlQUFLLFFBQVEsWUFBWSxPQUFPO0FBQUEsUUFDbEM7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBRUEsU0FBSztBQUFBLE1BQ0gsS0FBSyxJQUFJLE1BQU0sR0FBRyxVQUFVLENBQUMsU0FBUztBQUNwQyxZQUFJLGdCQUFnQiwwQkFBUyxLQUFLLGNBQWMsTUFBTTtBQUNwRCxlQUFLLFFBQVEsWUFBWSxLQUFLLElBQUk7QUFBQSxRQUNwQztBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFjLHdCQUF1QztBQUNuRCxVQUFNLFNBQVMsS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLG1CQUFtQjtBQUNyRSxVQUFNLFFBQVE7QUFBQSxNQUNaLE9BQU8sSUFBSSxPQUFPLFNBQVM7QUFDekIsY0FBTSxPQUFPLEtBQUs7QUFDbEIsWUFBSSxnQkFBZ0IsZUFBZTtBQUNqQyxnQkFBTSxLQUFLLE9BQU87QUFBQSxRQUNwQjtBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQ0Y7IiwKICAibmFtZXMiOiBbImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iXQp9Cg==
