import type { VaultAuditResult } from "../../types/audit";

export interface DashboardState {
  loading: boolean;
  result: VaultAuditResult | null;
}

export function createDashboardState(): DashboardState {
  return {
    loading: false,
    result: null,
  };
}
