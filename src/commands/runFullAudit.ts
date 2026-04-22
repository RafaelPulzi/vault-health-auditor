import type VaultHealthAuditorPlugin from "../main";

export async function runFullAuditCommand(plugin: VaultHealthAuditorPlugin): Promise<void> {
  await plugin.runFullAudit();
}
