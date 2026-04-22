import type { Plugin } from "obsidian";
import { DEFAULT_SETTINGS } from "../constants";
import type { VaultAuditResult } from "../types/audit";
import type { VaultHealthSettings } from "../types/settings";
import { deepClone, toHistoryEntry } from "../persistence/dataMappers";
import {
  DEFAULT_STORAGE_DATA,
  type PluginStorageData,
  type StoredAuditHistoryEntry,
} from "../persistence/storageSchema";

export class AuditRepository {
  constructor(private readonly plugin: Plugin) {}

  private async read(): Promise<PluginStorageData> {
    const raw = await this.plugin.loadData();

    return {
      settings: {
        ...DEFAULT_SETTINGS,
        ...(raw?.settings ?? {}),
      },
      audit: {
        lastResult: raw?.audit?.lastResult ?? DEFAULT_STORAGE_DATA.audit.lastResult,
        history: raw?.audit?.history ?? DEFAULT_STORAGE_DATA.audit.history,
      },
    };
  }

  async getSettings(fallback: VaultHealthSettings = DEFAULT_SETTINGS): Promise<VaultHealthSettings> {
    const data = await this.read();
    return {
      ...fallback,
      ...deepClone(data.settings),
    };
  }

  async saveSettings(settings: VaultHealthSettings): Promise<void> {
    const data = await this.read();
    data.settings = deepClone(settings);
    await this.plugin.saveData(data);
  }

  async getLastResult(): Promise<VaultAuditResult | null> {
    const data = await this.read();
    return data.audit.lastResult ? deepClone(data.audit.lastResult) : null;
  }

  async getHistory(): Promise<StoredAuditHistoryEntry[]> {
    const data = await this.read();
    return deepClone(data.audit.history);
  }

  async saveResult(result: VaultAuditResult): Promise<void> {
    const data = await this.read();
    data.audit.lastResult = deepClone(result);
    data.audit.history = [...data.audit.history, toHistoryEntry(result)].slice(-30);
    await this.plugin.saveData(data);
  }
}
