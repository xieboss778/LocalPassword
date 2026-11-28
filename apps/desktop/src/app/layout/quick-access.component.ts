import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import {
  DesktopShortcut,
  DesktopShortcutsService,
  ITEM_KIND_UI,
  LpKindTileComponent,
  LpToastService,
  clearClipboardIfStillHolding,
  clipboardClearSeconds,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { ClearClipboardDelay } from "@localpass/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@localpass/common/autofill/services/autofill-settings.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { FolderView } from "@localpass/common/vault/models/view/folder.view";
import { IconModule } from "@localpass/components";
import {
  DEFAULT_PASSWORD_OPTIONS,
  FIELDS,
  generatePasswords,
  isSecretCustomField,
  isSecretField,
  ItemKind,
  kindOf,
  readFieldValues,
  secretCustomFieldNames,
  withoutKindField,
} from "@localpass/local-vault";
import { PasswordRepromptService } from "@localpass/vault";

interface QuickRow {
  readonly item: CipherView;
  readonly kind: ItemKind;
  readonly subtitle: string;
  readonly folder: string;
  /** 命中的字段名，只在有检索词时显示；不暴露字段值。 */
  readonly matchLabel: string | null;
}

const GENERATED_PASSWORD_OPTIONS = { ...DEFAULT_PASSWORD_OPTIONS, length: 20 } as const;

/**
 * 应用内快速检索（⌘K）。只检索本机已解密保险库，不做系统全局热键监听。
 *
 * 结果行按全字段匹配（名称/用户名/网址/备注/文件夹/自定义字段/条目字段），
 * 支持 `=favorite` / `=totp` / `=passkey` / `=ssh` 过滤。打开结果跳回保险库详情，
 * ⌘C / ⇧⌘C 复制用户名/密码，⌘G 生成本地 20 位密码并复制。
 */
@Component({
  selector: "local-quick-access",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconModule, LpKindTileComponent],
  host: {
    class: "tw-contents",
    "(document:keydown.escape)": "onEscape($event)",
  },
  template: `
    @if (open()) {
      <div
        class="agy agy-qs-overlay"
        role="presentation"
        (click)="close()"
        (keydown)="onDialogKeydown($event)"
      >
        <div
          class="agy-qs"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="i18n.t('quickAccess')"
          (click)="$event.stopPropagation()"
        >
          <div class="agy-qs-in">
            <bit-icon name="bwi-search" class="tw-text-sm"></bit-icon>
            <input
              #qsInput
              type="search"
              class="agy-qs-input"
              autocomplete="off"
              spellcheck="false"
              [attr.placeholder]="i18n.t('searchAllFieldsPlaceholder')"
              [attr.aria-label]="i18n.t('quickAccess')"
              [value]="query()"
              (input)="onSearch($event)"
            />
            <span class="agy-chip agy-brand">{{ i18n.t("allFields") }}</span>
            <kbd>esc</kbd>
          </div>

          <div class="agy-qs-body">
            @if (loading()) {
              <p class="agy-qs-empty">{{ i18n.t("loading") }}</p>
            } @else if (results().length) {
              <div class="agy-qs-sect">{{ i18n.t("searchResults") }} · {{ results().length }}</div>
              @for (row of results(); track row.item.id; let i = $index) {
                <button
                  type="button"
                  class="agy-qs-row"
                  [attr.data-qs-index]="i"
                  [class.on]="i === activeIndex()"
                  (mouseenter)="activeIndex.set(i)"
                  (click)="pick(row)"
                >
                  <lp-kind-tile [kind]="row.kind" size="sm"></lp-kind-tile>
                  <span class="agy-qs-txt">
                    <span class="agy-qs-t">{{ row.item.name }}</span>
                    <span class="agy-qs-s">{{ row.subtitle }}</span>
                  </span>
                  <span class="agy-qs-meta">
                    @if (row.matchLabel) {
                      <span class="agy-chip agy-warn">{{ row.matchLabel }}</span>
                    }
                    <span class="agy-chip">{{ kindLabel(row.kind) }}</span>
                    @if (row.folder) {
                      <span class="agy-chip">{{ row.folder }}</span>
                    }
                  </span>
                </button>
              }
            } @else {
              <p class="agy-qs-empty">
                @if (query().trim()) {
                  {{ i18n.t("noResultsFor", query().trim()) }}
                } @else {
                  {{ i18n.t("noItemsInVault") }}
                }
              </p>
            }

            <div class="agy-qs-sect">{{ i18n.t("quickActions") }}</div>
            <button type="button" class="agy-qs-row" (click)="generateAndCopy()">
              <span class="agy-qs-actionicon">
                <bit-icon name="bwi-generate" class="tw-text-sm"></bit-icon>
              </span>
              <span class="agy-qs-txt">
                <span class="agy-qs-t">{{ i18n.t("quickAccessGenerate") }}</span>
              </span>
              <span class="agy-qs-meta"><kbd>&#8984;G</kbd></span>
            </button>
          </div>

          <div class="agy-qs-foot">
            <span><kbd>&#8593;</kbd><kbd>&#8595;</kbd> {{ i18n.t("select") }}</span>
            <span><kbd>&#8629;</kbd> {{ i18n.t("openItem") }}</span>
            <span><kbd>&#8984;C</kbd> {{ i18n.t("username") }}</span>
            <span><kbd>&#8679;&#8984;C</kbd> {{ i18n.t("password") }}</span>
            <span class="agy-qs-scope">{{ i18n.t("quickAccessScope") }}</span>
          </div>
        </div>
      </div>
    }
  `,
})
export class LocalQuickAccessComponent {
  protected readonly i18n = inject(I18nService);
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly folderService = inject(FolderService);
  private readonly router = inject(Router);
  private readonly toast = inject(LpToastService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly shortcutsService = inject(DesktopShortcutsService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly autofillSettingsService = inject(AutofillSettingsServiceAbstraction, {
    optional: true,
  });

  private readonly clearClipboardDelay = this.autofillSettingsService
    ? toSignal(this.autofillSettingsService.clearClipboardDelay$, {
        initialValue: ClearClipboardDelay.ThirtySeconds,
      })
    : signal(ClearClipboardDelay.ThirtySeconds);

  readonly open = input.required<boolean>();
  readonly closed = output<void>();

  protected readonly query = signal("");
  protected readonly activeIndex = signal(0);
  protected readonly ciphers = signal<CipherView[]>([]);
  protected readonly folders = signal<FolderView[]>([]);
  protected readonly loading = signal(false);

  private readonly qsInput = viewChild<ElementRef<HTMLInputElement>>("qsInput");

  private readonly folderNames = computed(() => {
    const map = new Map<string, string>();
    for (const folder of this.folders()) {
      map.set(folder.id, folder.name);
    }
    return map;
  });

  protected readonly results = computed<QuickRow[]>(() => {
    const raw = this.query().trim().toLowerCase();
    const folderNames = this.folderNames();
    const rows: QuickRow[] = [];

    for (const item of this.ciphers()) {
      const kind = kindOf(item);
      if (raw) {
        const match = this.matchQuery(item, kind, raw, folderNames);
        if (!match) {
          continue;
        }
        rows.push(this.toRow(item, kind, folderNames, match));
      } else {
        rows.push(this.toRow(item, kind, folderNames, null));
      }
    }

    return rows.sort((a, b) => {
      if (a.item.favorite !== b.item.favorite) {
        return a.item.favorite ? -1 : 1;
      }
      return this.revisionTime(b.item) - this.revisionTime(a.item);
    });
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      this.query.set("");
      this.activeIndex.set(0);
      void this.refresh();
      // 打开后才渲染输入框，等这一帧 DOM 建好再聚焦。
      setTimeout(() => this.qsInput()?.nativeElement.focus());
    });
  }

  protected kindLabel(kind: ItemKind): string {
    return this.i18n.t(ITEM_KIND_UI[kind].labelKey);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  protected onEscape(event: Event): void {
    if (!this.open()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.close();
  }

  protected async onDialogKeydown(event: KeyboardEvent): Promise<void> {
    // 对话框打开时，应用内其它 ⌘ 快捷键（新建/编辑/删除）不应同时生效。
    event.stopPropagation();
    const meta = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    const active = this.activeRow();

    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      return;
    }

    if (!meta && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      if (!this.results().length) {
        return;
      }
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = Math.min(this.results().length - 1, Math.max(0, this.activeIndex() + delta));
      this.activeIndex.set(next);
      setTimeout(() => {
        document
          .querySelector<HTMLElement>(`.agy-qs-row[data-qs-index="${next}"]`)
          ?.scrollIntoView({ block: "nearest" });
      });
      return;
    }

    if (!meta && event.key === "Enter") {
      if (!active) {
        return;
      }
      event.preventDefault();
      this.pick(active);
      return;
    }

    if (meta && key === "g") {
      event.preventDefault();
      this.generateAndCopy();
      return;
    }

    if (meta && key === "c" && !this.hasTextSelection()) {
      if (!active?.item.login) {
        return;
      }
      if (event.shiftKey) {
        if (!active.item.login.password || !this.shortcutsService.isEnabled(DesktopShortcut.Copy)) {
          return;
        }
        event.preventDefault();
        await this.copy(active.item.login.password, this.i18n.t("password"), active.item, true);
        return;
      }
      if (active.item.login.username && this.shortcutsService.isEnabled(DesktopShortcut.Copy)) {
        event.preventDefault();
        await this.copy(active.item.login.username, this.i18n.t("username"), active.item);
      }
    }
  }

  protected pick(row: QuickRow): void {
    this.close();
    void this.router.navigate(["/vault"], {
      queryParams: { cipherId: row.item.id },
    });
  }

  protected generateAndCopy(): void {
    const [password] = generatePasswords(1, GENERATED_PASSWORD_OPTIONS);
    if (!password) {
      return;
    }
    this.platformUtilsService.copyToClipboard(password);
    const delay = clipboardClearSeconds(this.clearClipboardDelay());
    if (delay > 0) {
      this.toast.showClipboard(
        this.i18n.t("passwordGenerated"),
        () => clearClipboardIfStillHolding(this.platformUtilsService, password),
        delay,
      );
    } else {
      this.toast.show(this.i18n.t("passwordGenerated"));
    }
  }

  protected close(): void {
    this.closed.emit();
  }

  private activeRow(): QuickRow | null {
    const rows = this.results();
    if (!rows.length) {
      return null;
    }
    return rows[Math.min(this.activeIndex(), rows.length - 1)] ?? null;
  }

  private async copy(
    value: string,
    label: string,
    cipher: CipherView,
    protectedValue = false,
  ): Promise<void> {
    if (
      protectedValue &&
      !(await this.passwordRepromptService.passwordRepromptCheck(cipher).catch(() => false))
    ) {
      return;
    }
    // 走平台剪贴板服务：桌面端会按设置安排自动清空，并避免写入历史。
    this.platformUtilsService.copyToClipboard(value);
    const message = this.i18n.t("valueCopied", label);
    const delay = clipboardClearSeconds(this.clearClipboardDelay());
    if (delay > 0) {
      this.toast.showClipboard(
        message,
        () => clearClipboardIfStillHolding(this.platformUtilsService, value),
        delay,
      );
    } else {
      this.toast.show(message);
    }
  }

  /** 输入框里选中了文字时，⌘C 应执行系统复制，而不是复制条目字段。 */
  private hasTextSelection(): boolean {
    const element = document.activeElement;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      if (element.selectionStart !== element.selectionEnd) {
        return true;
      }
    }
    return !!window.getSelection()?.toString();
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const [ciphers, folders] = await Promise.all([
        this.cipherService.getAllDecrypted(userId),
        firstValueFrom(this.folderService.folderViews$(userId)),
      ]);
      // 回收站与已归档条目不参与默认检索。
      this.ciphers.set(
        ciphers.filter((cipher) => !cipher.isDeleted && cipher.archivedDate == null),
      );
      this.folders.set(folders.filter((folder) => folder.id !== ""));
    } catch {
      this.ciphers.set([]);
      this.folders.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private toRow(
    item: CipherView,
    kind: ItemKind,
    folderNames: ReadonlyMap<string, string>,
    matchLabel: string | null,
  ): QuickRow {
    return {
      item,
      kind,
      subtitle: this.subtitleOf(item, kind),
      folder: item.folderId ? (folderNames.get(item.folderId) ?? "") : "",
      matchLabel,
    };
  }

  private subtitleOf(item: CipherView, kind: ItemKind): string {
    const values = readFieldValues(item, kind);
    const label = this.kindLabel(kind);
    switch (kind) {
      case ItemKind.Login:
        return values.username || label;
      case ItemKind.Token: {
        const env = values.env;
        const envLabel =
          !env || /环境$|environment$/i.test(env) ? env : this.i18n.t("environmentLabel", env);
        return [label, envLabel].filter((part): part is string => !!part).join(" · ");
      }
      case ItemKind.Server: {
        const protocol = values.protocol?.toUpperCase();
        return [values.host, protocol || label]
          .filter((part): part is string => !!part)
          .join(" · ");
      }
      case ItemKind.Card: {
        const last4 = /(\d{4})\s*$/.exec(values.number ?? "")?.[1];
        return last4 ? `•••• ${last4}` : label;
      }
      case ItemKind.Note: {
        const notes = values.notes?.trim();
        return notes
          ? `${label} · ${this.i18n.t("lineCount", String(notes.split(/\r?\n/).length))}`
          : label;
      }
      case ItemKind.License:
        return [label, values.seats].filter((part): part is string => !!part).join(" · ");
      case ItemKind.SshKey:
      case ItemKind.Identity:
        return label;
    }
  }

  /** 返回命中的字段名；语法过滤用语法本身作为标记。 */
  private matchQuery(
    item: CipherView,
    kind: ItemKind,
    query: string,
    folderNames: ReadonlyMap<string, string>,
  ): string | null {
    switch (query) {
      case "=favorite":
        return item.favorite ? query : null;
      case "=totp":
        return item.login?.totp ? query : null;
      case "=passkey":
        return item.login?.fido2Credentials?.length ? query : null;
      case "=ssh":
        return kind === ItemKind.SshKey || kind === ItemKind.Server ? query : null;
    }

    const values = readFieldValues(item, kind);
    // 密码、TOTP 种子与隐藏自定义字段的值不参与匹配：输入秘密片段不能反查条目。
    const candidates: (readonly [string, string])[] = FIELDS[kind]
      .filter((field) => !isSecretField(field))
      .map((field) => [this.i18n.t(field.labelKey), values[field.id] ?? ""]);
    candidates.push([
      this.i18n.t("folder"),
      item.folderId ? (folderNames.get(item.folderId) ?? "") : "",
    ]);
    const secretCustomNames = secretCustomFieldNames(kind);
    candidates.push([
      this.i18n.t("customFields"),
      withoutKindField(item.fields)
        .map((field) => {
          const name = field.name ?? "";
          if (secretCustomNames.has(name) || isSecretCustomField(field)) {
            return name;
          }
          return `${name} ${field.value ?? ""}`;
        })
        .join(" "),
    ]);

    for (const [label, value] of candidates) {
      if (value.toLowerCase().includes(query)) {
        return label;
      }
    }
    return null;
  }

  private revisionTime(item: CipherView): number {
    const time = item.revisionDate?.getTime() ?? 0;
    return Number.isNaN(time) ? 0 : time;
  }
}
