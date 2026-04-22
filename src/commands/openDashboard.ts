import type VaultHealthAuditorPlugin from "../main";

export async function openDashboard(plugin: VaultHealthAuditorPlugin): Promise<void> {
  await plugin.ensureDashboardOpen();
}
