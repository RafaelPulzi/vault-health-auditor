import { ItemView, WorkspaceLeaf } from "obsidian";
import { PLUGIN_NAME, VIEW_TYPE_DASHBOARD } from "../../constants";
import type VaultHealthAuditorPlugin from "../../main";

export class DashboardView extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: VaultHealthAuditorPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_DASHBOARD;
  }

  getDisplayText(): string {
    return PLUGIN_NAME;
  }

  getIcon(): string {
    return "activity";
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async render(): Promise<void> {
    const result = await this.plugin.repository.getLastResult();
    const history = await this.plugin.repository.getHistory();

    this.contentEl.empty();
    this.contentEl.addClass("vha-dashboard");

    const header = this.contentEl.createDiv({ cls: "vha-header" });
    header.createEl("h2", { text: "Vault Health Auditor" });

    const actionRow = header.createDiv({ cls: "vha-actions" });
    const fullAuditButton = actionRow.createEl("button", {
      text: "Run full audit",
      cls: "mod-cta",
    });
    fullAuditButton.addEventListener("click", async () => {
      await this.plugin.runFullAudit();
      await this.render();
    });

    const incrementalButton = actionRow.createEl("button", {
      text: "Run incremental audit",
    });
    incrementalButton.addEventListener("click", async () => {
      await this.plugin.runIncrementalAudit();
      await this.render();
    });

    if (!result) {
      this.contentEl.createEl("p", {
        text: "Nenhuma auditoria foi executada ainda. Rode um full audit para gerar os primeiros resultados.",
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
      text: JSON.stringify(result.breakdown.issueCountBySeverity, null, 2),
    });

    const categoryBlock = this.contentEl.createDiv({ cls: "vha-block" });
    categoryBlock.createEl("h3", { text: "Category scores" });
    categoryBlock.createEl("pre", {
      text: JSON.stringify(result.breakdown.byCategory, null, 2),
    });

    const offendersBlock = this.contentEl.createDiv({ cls: "vha-block" });
    offendersBlock.createEl("h3", { text: "Top offenders" });
    if (result.topOffenders.length === 0) {
      offendersBlock.createEl("p", { text: "Sem destaques negativos no momento." });
    } else {
      const offendersList = offendersBlock.createEl("ol");
      for (const offender of result.topOffenders) {
        offendersList.createEl("li", {
          text: `${offender.path} â€” impact ${offender.impact} / ${offender.issueCount} issue(s)`,
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

        if (issue.evidence?.length) {
          item.createEl("pre", { text: issue.evidence.join("\n") });
        }
      }
    }

    const historyBlock = this.contentEl.createDiv({ cls: "vha-block" });
    historyBlock.createEl("h3", { text: "History" });
    if (history.length === 0) {
      historyBlock.createEl("p", { text: "Ainda nÃ£o hÃ¡ histÃ³rico persistido." });
    } else {
      const historyList = historyBlock.createEl("ul");
      for (const entry of history.slice(-10).reverse()) {
        historyList.createEl("li", {
          text: `${new Date(entry.timestamp).toLocaleString()} â€” score ${entry.total}, issues ${entry.issueCount}, files ${entry.filesScanned}`,
        });
      }
    }
  }

  private createCard(container: HTMLElement, title: string, value: string): void {
    const card = container.createDiv({ cls: "vha-card" });
    card.createEl("small", { text: title });
    card.createEl("h3", { text: value });
  }
}
