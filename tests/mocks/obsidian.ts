import { vi } from "vitest";

export class TFile {
  constructor(
    public path: string,
    public basename: string,
    public stat: { mtime: number; ctime: number; size: number },
    public extension = "md",
  ) {}
}

export class Plugin {
  async loadData() {
    return {};
  }

  async saveData(_data: unknown) {
    return;
  }
}

export const mockVault = {
  getMarkdownFiles: vi.fn(),
  cachedRead: vi.fn(),
  on: vi.fn((_event, callback) => callback),
};

export const mockMetadataCache = {
  getFileCache: vi.fn(),
  getFirstLinkpathDest: vi.fn(),
  unresolvedLinks: {},
};

export const mockWorkspace = {
  getLeavesOfType: vi.fn(() => []),
  getRightLeaf: vi.fn(),
  revealLeaf: vi.fn(),
  detachLeavesOfType: vi.fn(),
  onLayoutReady: vi.fn((callback) => callback()),
};

export const mockApp = {
  vault: mockVault,
  metadataCache: mockMetadataCache,
  workspace: mockWorkspace,
};
