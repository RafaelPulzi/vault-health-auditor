import type { VaultHealthSettings } from "../../types/settings";
import { DEFAULT_SETTINGS } from "../../constants";

export function createSettingsState(): VaultHealthSettings {
  return { ...DEFAULT_SETTINGS };
}
