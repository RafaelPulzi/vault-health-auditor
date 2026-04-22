import { Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import {
  DEFAULT_SETTINGS,
  VIEW_TYPE_DASHBOARD,
} from "./constants";
import type { VaultHealthSettings } from "./types/settings";
import { AuditRepository } from "./core/AuditRepository";
import { SnapshotBuilder } from "./core/SnapshotBuilder";
import { RuleRegistry } from "./core/RuleRegistry";
import { HealthScoreService } from "./scoring/HealthScoreService";
import { Scheduler } from "./core/Scheduler";
import { AuditEngine } from "./core/AuditEngine";
import { DashboardView } from "./ui/views/DashboardView";
import { VaultHealthSettingTab } from "./ui/settings/VaultHealthSettingTab";
import { IncrementalIndexer } from "./core/IncrementalIndexer";
import { openDashboard } from "./commands/openDashboard";
import { runFullAuditCommand } from "./commands/runFullAudit";
import { runIncrementalAuditCommand } from "./commands/runIncrementalAudit";
import { logger } from "./utils/logger";

export default class VaultHealthAuditorPlugin extends Plugin {
  settings: VaultHealthSettings = DEFAULT_SETTINGS;
  repository!: AuditRepository;
  progress = { scanned: 0, total: 0 };

  private readonly indexer = new IncrementalIndexer();
  private engine!: AuditEngine;
  private running = false;

  async onload(): Promise<void> {
    logger.info("Loading plugin");

    this.repository = new AuditRepository(this);
    this.settings = await this.repository.getSettings(DEFAULT_SETTINGS);
    this.engine = this.createEngine();

    this.registerView(
      VIEW_TYPE_DASHBOARD,
      (leaf) => new DashboardView(leaf, this),
    );

    this.addSettingTab(new VaultHealthSettingTab(this.app, this));

    this.addCommand({
      id: "open-dashboard",
      name: "Open audit dashboard",
      callback: () => openDashboard(this),
    });

    this.addCommand({
      id: "run-full-audit",
      name: "Run full audit",
      callback: () => runFullAuditCommand(this),
    });

    this.addCommand({
      id: "run-incremental-audit",
      name: "Run incremental audit",
      callback: () => runIncrementalAuditCommand(this),
    });

    this.registerVaultEvents();

    this.app.workspace.onLayoutReady(async () => {
      if (this.settings.fullAuditOnStartup) {
        await this.runFullAudit();
      }
    });
  }

  onunload(): void {
    logger.info("Unloading plugin");
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_DASHBOARD);
  }

  async savePluginSettings(): Promise<void> {
    await this.repository.saveSettings(this.settings);
    this.engine = this.createEngine();
    await this.refreshDashboardViews();
  }

  async ensureDashboardOpen(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
    let leaf = leaves[0];

    if (!leaf) {
      const newLeaf = this.app.workspace.getRightLeaf(false);

      if (!newLeaf) {
        new Notice("Não foi possível abrir o dashboard.");
        return;
      }

      leaf = newLeaf;

      await leaf.setViewState({
        type: VIEW_TYPE_DASHBOARD,
        active: true,
      });
    }

    this.app.workspace.revealLeaf(leaf);
  }

  async runFullAudit(): Promise<void> {
    if (this.running) {
      new Notice("Uma auditoria jÃ¡ estÃ¡ em execuÃ§Ã£o.");
      return;
    }

    try {
      this.running = true;
      this.progress = { scanned: 0, total: 0 };
      new Notice("Executando full audit...");

      const result = await this.engine.runFullAudit();
      await this.refreshDashboardViews();

      new Notice(`Auditoria concluÃ­da. Score: ${result.breakdown.total}. Issues: ${result.issues.length}.`);
    } catch (error) {
      logger.error(error);
      new Notice(`Erro durante full audit: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }

  async runIncrementalAudit(): Promise<void> {
    if (this.running) {
      new Notice("Uma auditoria jÃ¡ estÃ¡ em execuÃ§Ã£o.");
      return;
    }

    const dirtyPaths = this.indexer.consumeDirty();
    if (dirtyPaths.length === 0) {
      new Notice("Nenhuma nota modificada desde a Ãºltima verificaÃ§Ã£o incremental.");
      return;
    }

    try {
      this.running = true;
      this.progress = { scanned: 0, total: dirtyPaths.length };
      new Notice(`Executando incremental audit em ${dirtyPaths.length} nota(s)...`);

      const result = await this.engine.runIncrementalAudit(dirtyPaths);
      await this.refreshDashboardViews();

      new Notice(`Incremental audit concluÃ­do. Score atual: ${result.breakdown.total}.`);
    } catch (error) {
      logger.error(error);
      new Notice(`Erro durante incremental audit: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }

  private createEngine(): AuditEngine {
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
      },
    );
  }

  private registerVaultEvents(): void {
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.indexer.markDirty(file.path);
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.indexer.markDirty(file.path);
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile && file.extension === "md") {
          this.indexer.markDirty(file.path);
          this.indexer.markDeleted(oldPath);
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.indexer.markDeleted(file.path);
        }
      }),
    );
  }

  private async refreshDashboardViews(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
    await Promise.all(
      leaves.map(async (leaf) => {
        const view = leaf.view;
        if (view instanceof DashboardView) {
          await view.render();
        }
      }),
    );
  }
}
