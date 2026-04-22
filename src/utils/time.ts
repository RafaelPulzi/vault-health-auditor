export const DAY_MS = 1000 * 60 * 60 * 24;

export function parseDateLike(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

export function diffDays(fromTimestamp: number, toTimestamp: number): number {
  return Math.floor((toTimestamp - fromTimestamp) / DAY_MS);
}
