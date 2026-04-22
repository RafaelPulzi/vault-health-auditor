export class IncrementalIndexer {
  private readonly dirtyPaths = new Set<string>();

  markDirty(path: string): void {
    this.dirtyPaths.add(path);
  }

  markDeleted(path: string): void {
    this.dirtyPaths.add(path);
  }

  clear(): void {
    this.dirtyPaths.clear();
  }

  consumeDirty(): string[] {
    const paths = Array.from(this.dirtyPaths);
    this.dirtyPaths.clear();
    return paths;
  }
}
