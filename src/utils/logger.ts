export const logger = {
  info: (...args: unknown[]) => console.info("[VaultHealthAuditor]", ...args),
  warn: (...args: unknown[]) => console.warn("[VaultHealthAuditor]", ...args),
  error: (...args: unknown[]) => console.error("[VaultHealthAuditor]", ...args),
};
