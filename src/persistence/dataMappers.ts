import type { VaultAuditResult } from "../types/audit";
import type { StoredAuditHistoryEntry } from "./storageSchema";

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function toHistoryEntry(result: VaultAuditResult): StoredAuditHistoryEntry {
  return {
    timestamp: result.finishedAt,
    total: result.breakdown.total,
    issueCount: result.issues.length,
    filesScanned: result.filesScanned,
  };
}
