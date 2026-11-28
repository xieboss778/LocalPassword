import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { UserId } from "@localpass/common/types/guid";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherData } from "@localpass/common/vault/models/data/cipher.data";
import { FolderData } from "@localpass/common/vault/models/data/folder.data";
import { Cipher } from "@localpass/common/vault/models/domain/cipher";
import { Folder } from "@localpass/common/vault/models/domain/folder";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { IconModule } from "@localpass/components";
import { KeyService } from "@localpass/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService } from "@localpass/legacy-crypto";
import {
  diffFieldLabelKeys,
  PendingVaultConflict,
  VaultConflictChoice,
  VaultBackupSyncService,
  VaultRecord,
} from "@localpass/local-vault";

import { formatBackupTimestamp } from "./backup-time";

interface ConflictRow {
  readonly id: string;
  readonly isFolder: boolean;
  readonly localLabel: string;
  readonly remoteLabel: string;
  readonly localTime: string;
  readonly remoteTime: string;
  /** Labels of fields whose values differ; the values themselves are never rendered. */
  readonly changedFields: readonly string[];
}

interface ChoiceOption {
  readonly value: VaultConflictChoice;
  readonly labelKey: string;
  readonly hintKey: string;
}

/**
 * Side-by-side review of records that changed on both this device and the cloud.
 *
 * Both payloads are decrypted in memory to derive display names and which fields differ. Only
 * names, revision times and field labels are rendered; field values never reach the DOM, the log
 * or an error message. Neither version is uploaded until the user submits a choice.
 */
@Component({
  selector: "backup-conflict-resolution-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconModule],
  template: `
    <div class="tw-flex tw-flex-col tw-gap-2">
      <div class="tw-flex tw-items-start tw-gap-2 tw-rounded-lg tw-bg-bg-warning-soft tw-p-3">
        <bit-icon
          name="bwi-exclamation-triangle"
          class="tw-mt-0.5 tw-flex-none tw-text-base tw-text-fg-warning"
        ></bit-icon>
        <div class="tw-min-w-0">
          <div class="tw-text-sm tw-font-semibold tw-text-main">
            {{ i18n.t("syncConflictTitle") }}
          </div>
          <div class="tw-mt-0.5 tw-text-xs tw-text-muted">{{ i18n.t("syncConflictNotice") }}</div>
        </div>
      </div>

      @for (row of rows(); track row.id) {
        <div class="tw-rounded-lg tw-border tw-border-border-light tw-bg-background">
          <div
            class="tw-flex tw-items-center tw-gap-2 tw-border-b tw-border-border-light tw-px-3 tw-py-2"
          >
            <span
              class="tw-min-w-0 tw-flex-1 tw-truncate tw-text-sm tw-font-semibold tw-text-main"
              >{{ row.localLabel }}</span
            >
            @if (row.isFolder) {
              <span
                class="tw-flex-none tw-rounded-full tw-bg-background-alt tw-px-2 tw-py-0.5 tw-text-xs tw-text-muted"
                >{{ i18n.t("syncConflictFolder") }}</span
              >
            }
          </div>

          <div class="tw-grid tw-grid-cols-2 tw-gap-2 tw-p-3">
            <div class="tw-min-w-0 tw-rounded-md tw-bg-background-alt tw-p-2">
              <div class="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-font-medium tw-text-muted">
                <bit-icon name="bwi-desktop" class="tw-flex-none tw-text-sm"></bit-icon>
                <span class="tw-truncate">{{ i18n.t("syncConflictLocalSide") }}</span>
              </div>
              <div class="tw-mt-1 tw-truncate tw-text-sm tw-text-main" [title]="row.localLabel">
                {{ row.localLabel }}
              </div>
              <div class="tw-mt-0.5 tw-truncate tw-text-xs tw-text-muted">
                {{ row.localTime }}
              </div>
            </div>
            <div class="tw-min-w-0 tw-rounded-md tw-bg-background-alt tw-p-2">
              <div class="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-font-medium tw-text-muted">
                <bit-icon name="bwi-globe" class="tw-flex-none tw-text-sm"></bit-icon>
                <span class="tw-truncate">{{ i18n.t("syncConflictRemoteSide") }}</span>
              </div>
              <div class="tw-mt-1 tw-truncate tw-text-sm tw-text-main" [title]="row.remoteLabel">
                {{ row.remoteLabel }}
              </div>
              <div class="tw-mt-0.5 tw-truncate tw-text-xs tw-text-muted">
                {{ row.remoteTime }}
              </div>
            </div>
          </div>

          @if (row.changedFields.length > 0) {
            <div class="tw-border-t tw-border-border-light tw-px-3 tw-py-2">
              <div class="tw-text-xs tw-text-muted">
                {{ i18n.t("syncConflictFieldsDiffer", row.changedFields.length.toString()) }}
              </div>
              <div class="tw-mt-1 tw-flex tw-flex-wrap tw-gap-1">
                @for (field of row.changedFields; track field) {
                  <span
                    class="tw-rounded-full tw-bg-bg-warning-soft tw-px-2 tw-py-0.5 tw-text-xs tw-text-fg-warning"
                    >{{ field }}</span
                  >
                }
              </div>
            </div>
          }

          <div
            class="tw-grid tw-gap-1.5 tw-px-3 tw-pb-3"
            [class.tw-grid-cols-1]="compact()"
            [class.tw-grid-cols-3]="!compact()"
          >
            @for (option of choiceOptions; track option.value) {
              <button
                type="button"
                class="tw-rounded-md tw-border tw-bg-background tw-p-2 tw-text-start hover:tw-bg-background-alt disabled:tw-opacity-50"
                [class.tw-border-primary-600]="choiceOf(row.id) === option.value"
                [class.tw-bg-bg-brand-softer]="choiceOf(row.id) === option.value"
                [attr.aria-pressed]="choiceOf(row.id) === option.value"
                [disabled]="busy()"
                (click)="pick(row.id, option.value)"
              >
                <span
                  class="tw-block tw-text-xs tw-font-semibold"
                  [class.tw-text-fg-brand]="choiceOf(row.id) === option.value"
                  [class.tw-text-main]="choiceOf(row.id) !== option.value"
                >
                  {{ i18n.t(option.labelKey) }}
                </span>
                <span class="tw-mt-0.5 tw-block tw-text-xs tw-text-muted">
                  {{ i18n.t(option.hintKey) }}
                </span>
              </button>
            }
          </div>
        </div>
      }

      <div class="tw-flex tw-items-center tw-gap-2">
        <button
          type="button"
          class="tw-inline-flex tw-h-10 tw-flex-1 tw-items-center tw-justify-center tw-rounded-lg tw-bg-bg-brand tw-px-4 tw-text-sm tw-font-semibold tw-text-contrast hover:tw-bg-bg-brand-strong disabled:tw-opacity-50"
          [disabled]="busy() || rows().length === 0"
          data-testid="backup_conflict_resolve"
          (click)="submit()"
        >
          {{ i18n.t("syncConflictResolve") }}
        </button>
      </div>

      @if (errorMessage()) {
        <p class="tw-m-0 tw-text-xs tw-text-fg-danger" role="alert">{{ errorMessage() }}</p>
      }
    </div>
  `,
})
export class BackupConflictResolutionV2Component implements OnChanges {
  protected readonly i18n = inject(I18nService);
  private readonly syncService = inject(VaultBackupSyncService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly keyService = inject(KeyService, { optional: true });
  private readonly encryptService = inject(EncryptService, { optional: true });
  private readonly locale = toSignal(this.i18n.locale$, { initialValue: "en" });

  readonly conflicts = input.required<readonly PendingVaultConflict[]>();
  /** Popup sheets stack the choices; the desktop dashboard keeps them side by side. */
  readonly compact = input(false);
  readonly resolved = output<void>();

  protected readonly rows = signal<readonly ConflictRow[]>([]);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  private readonly choices = signal<Record<string, VaultConflictChoice>>({});

  protected readonly choiceOptions: readonly ChoiceOption[] = [
    { value: "both", labelKey: "syncConflictKeepBoth", hintKey: "syncConflictKeepBothHint" },
    { value: "local", labelKey: "syncConflictKeepLocal", hintKey: "syncConflictKeepLocalHint" },
    { value: "remote", labelKey: "syncConflictKeepRemote", hintKey: "syncConflictKeepRemoteHint" },
  ];

  /** Monotonic token so a slow decrypt for an older input cannot overwrite newer rows. */
  private readonly buildToken = signal(0);

  async ngOnChanges(): Promise<void> {
    await this.buildRows();
  }

  protected choiceOf(id: string): VaultConflictChoice {
    return this.choices()[id] ?? "both";
  }

  protected pick(id: string, choice: VaultConflictChoice): void {
    this.choices.update((current) => ({ ...current, [id]: choice }));
  }

  protected async submit(): Promise<void> {
    if (this.busy() || this.rows().length === 0) {
      return;
    }
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const result = await this.syncService.resolveConflicts(await this.userId(), this.choices());
      if (!result.uploaded) {
        // A manifest race leaves the choices pending; the user can submit again.
        this.errorMessage.set(this.i18n.t("syncConflictFailed"));
        return;
      }
      this.rows.set([]);
      this.choices.set({});
      this.resolved.emit();
    } catch {
      this.errorMessage.set(this.i18n.t("syncConflictFailed"));
    } finally {
      this.busy.set(false);
    }
  }

  private async buildRows(): Promise<void> {
    this.buildToken.update((value) => value + 1);
    const token = this.buildToken();
    const conflicts = this.conflicts();
    if (conflicts.length === 0) {
      this.rows.set([]);
      this.choices.set({});
      return;
    }

    const userId = await this.userId();
    const folderLabel = this.i18n.t("syncConflictFolder");
    const rows = await Promise.all(
      conflicts.map(async (conflict): Promise<ConflictRow> => {
        const sides =
          conflict.kind === "cipher"
            ? await this.cipherSides(conflict, userId)
            : await this.folderSides(conflict, userId, folderLabel);
        return {
          id: conflict.id,
          isFolder: conflict.kind === "folder",
          localLabel: sides.localLabel,
          remoteLabel: sides.remoteLabel,
          localTime: this.timeLabel(conflict.local.revisionDate),
          remoteTime: this.timeLabel(conflict.remote.revisionDate),
          changedFields: sides.changedFields,
        };
      }),
    );
    if (token !== this.buildToken()) {
      return;
    }

    this.rows.set(rows);
    const current = this.choices();
    const next: Record<string, VaultConflictChoice> = {};
    for (const conflict of conflicts) {
      next[conflict.id] = current[conflict.id] ?? "both";
    }
    this.choices.set(next);
  }

  private async folderSides(
    conflict: PendingVaultConflict,
    userId: UserId,
    fallback: string,
  ): Promise<{
    localLabel: string;
    remoteLabel: string;
    changedFields: readonly string[];
  }> {
    const [local, remote] = await Promise.all([
      this.decryptFolderName(conflict.local, userId, fallback),
      this.decryptFolderName(conflict.remote, userId, fallback),
    ]);
    return {
      localLabel: local,
      remoteLabel: remote,
      changedFields: local !== remote ? [this.i18n.t("folderName")] : [],
    };
  }

  private async decryptFolderName(
    record: VaultRecord,
    userId: UserId,
    fallback: string,
  ): Promise<string> {
    if (record.data == null || !this.keyService || !this.encryptService) {
      return fallback;
    }
    try {
      const userKey = await firstValueFrom(this.keyService.userKey$(userId));
      if (userKey == null) {
        return fallback;
      }
      const view = await new Folder(record.data as FolderData).decryptWithKey(
        userKey,
        this.encryptService,
      );
      return view.name?.trim() || fallback;
    } catch {
      return fallback;
    }
  }

  private async cipherSides(
    conflict: PendingVaultConflict,
    userId: UserId,
  ): Promise<{
    localLabel: string;
    remoteLabel: string;
    changedFields: readonly string[];
  }> {
    const [local, remote] = await Promise.all([
      this.decryptCipher(conflict.local, userId),
      this.decryptCipher(conflict.remote, userId),
    ]);
    return {
      localLabel: this.labelOf(local),
      remoteLabel: this.labelOf(remote),
      changedFields: this.changedFields(local, remote),
    };
  }

  private async decryptCipher(record: VaultRecord, userId: UserId): Promise<CipherView | null> {
    if (record.data == null) {
      return null;
    }
    try {
      return await this.cipherService.decrypt(new Cipher(record.data as CipherData), userId);
    } catch {
      // A record this key cannot open still gets a neutral label; never surface crypto errors.
      return null;
    }
  }

  private labelOf(view: CipherView | null): string {
    return view?.name?.trim() || this.i18n.t("syncConflictUntitledItem");
  }

  /** Field labels only: comparing the decrypted values here must never render them. */
  private changedFields(local: CipherView | null, remote: CipherView | null): readonly string[] {
    if (local == null || remote == null) {
      return [];
    }
    return diffFieldLabelKeys(local, remote).map((key) => this.i18n.t(key));
  }

  private timeLabel(revisionDate: string): string {
    return this.i18n.t(
      "syncConflictUpdatedAt",
      formatBackupTimestamp(revisionDate, this.locale(), this.i18n),
    );
  }

  private async userId(): Promise<UserId> {
    return await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
  }
}
