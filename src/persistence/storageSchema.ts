import { DEFAULT_SETTINGS } from "../constants";
import type { VaultAuditResult } from "../types/audit";
import type { VaultHealthSettings } from "../types/settings";

export interface StoredAuditHistoryEntry {
  timestamp: number;
  total: number;
  issueCount: number;
  filesScanned: number;
}

export interface StoredAuditData {
  lastResult: VaultAuditResult | null;
  history: StoredAuditHistoryEntry[];
}

export interface PluginStorageData {
  settings: VaultHealthSettings;
  audit: StoredAuditData;
}

export const DEFAULT_STORAGE_DATA: PluginStorageData = {
  settings: DEFAULT_SETTINGS,
  audit: {
    lastResult: null,
    history: [],
  },
};
