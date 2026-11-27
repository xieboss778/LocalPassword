import { Injectable, signal } from "@angular/core";

import { UpgradeImportType } from "../models";

export interface StagedPreviewFile {
  readonly importType: UpgradeImportType;
  readonly fileName: string;
  /** Read only in memory so the preview can parse it; never written to storage or logs. */
  readonly contents: string;
}

/**
 * Hands a picked file from the import source screen to the preview screen.
 *
 * A single in-memory slot: the file may be a decrypted export, so it must not touch storage,
 * survive a reload, or be read after the preview page has taken it.
 */
@Injectable({ providedIn: "root" })
export class ImportPreviewStagingService {
  private readonly staged = signal<StagedPreviewFile | null>(null);

  set(file: StagedPreviewFile): void {
    this.staged.set(file);
  }

  /** Removes and returns the staged file, so a refresh cannot parse it twice. */
  take(): StagedPreviewFile | null {
    const file = this.staged();
    this.staged.set(null);
    return file;
  }

  clear(): void {
    this.staged.set(null);
  }
}
