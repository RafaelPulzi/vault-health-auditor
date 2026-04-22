export function normalizePathLike(input: string): string {
  return input.replace(/\\/g, "/").trim();
}

export function isIgnoredPath(path: string, ignoredFolders: string[]): boolean {
  const normalized = normalizePathLike(path).toLowerCase();

  return ignoredFolders.some((folder) => {
    const candidate = normalizePathLike(folder).toLowerCase();
    return normalized === candidate || normalized.startsWith(`${candidate}/`);
  });
}
