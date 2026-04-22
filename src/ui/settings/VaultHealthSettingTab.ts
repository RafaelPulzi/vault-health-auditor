import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type VaultHealthAuditorPlugin from "../../main";

export class VaultHealthSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: VaultHealthAuditorPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Vault Health Auditor settings" });

    new Setting(containerEl)
      .setName("Run full audit on startup")
      .setDesc("Executa uma auditoria completa sempre que o Obsidian iniciar.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.fullAuditOnStartup)
          .onChange(async (value) => {
            this.plugin.settings.fullAuditOnStartup = value;
            await this.plugin.savePluginSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Custom review field")
      .setDesc("Campo de frontmatter usado como data de revisÃ£o, por exemplo: reviewed_at")
      .addText((text) =>
        text
          .setPlaceholder("reviewed_at")
          .setValue(this.plugin.settings.customReviewField)
          .onChange(async (value) => {
            this.plugin.settings.customReviewField = value.trim() || "reviewed_at";
            await this.plugin.savePluginSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Batch size")
      .setDesc("Quantidade de notas processadas por lote.")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.batchSize))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (Number.isFinite(parsed) && parsed > 0) {
              this.plugin.settings.batchSize = parsed;
              await this.plugin.savePluginSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Large note threshold")
      .setDesc("Quantidade mÃ­nima de palavras para classificar nota como grande.")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.largeNoteWordThreshold))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (Number.isFinite(parsed) && parsed > 0) {
              this.plugin.settings.largeNoteWordThreshold = parsed;
              await this.plugin.savePluginSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Note type policies (JSON)")
      .setDesc("Edite as polÃ­ticas por tipo de nota em JSON.")
      .addTextArea((text) =>
        text
          .setPlaceholder("[]")
          .setValue(JSON.stringify(this.plugin.settings.noteTypePolicies, null, 2))
          .onChange(async (value) => {
            try {
              const parsed = JSON.parse(value);
              if (!Array.isArray(parsed)) {
                throw new Error("O valor precisa ser um array JSON.");
              }

              this.plugin.settings.noteTypePolicies = parsed;
              await this.plugin.savePluginSettings();
            } catch (error) {
              new Notice(`JSON invÃ¡lido em noteTypePolicies: ${String(error)}`);
            }
          }),
      );
  }
}
