import type VaultHealthAuditorPlugin from "../main";

export async function runIncrementalAuditCommand(plugin: VaultHealthAuditorPlugin): Promise<void> {
  await plugin.runIncrementalAudit();
}
