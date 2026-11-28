import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { LpToastService } from "@localpass/angular/local-ui";
import { CipherVersionHistoryService } from "@localpass/angular/vault/services/cipher-version-history.service";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { GlobalStateProvider } from "@localpass/common/platform/state";
import { FakeGlobalStateProvider } from "@localpass/common/spec";
import { PasswordStrengthServiceAbstraction } from "@localpass/common/tools/password-strength";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { TotpService } from "@localpass/common/vault/abstractions/totp.service";
import { CipherRepromptType } from "@localpass/common/vault/enums/cipher-reprompt-type";
import { CipherType } from "@localpass/common/vault/enums/cipher-type";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { PasswordHistoryView } from "@localpass/common/vault/models/view/password-history.view";
import { DialogService } from "@localpass/components";
import { PasswordRepromptService } from "@localpass/vault";

import { VaultDesktopV2Component } from "./vault-desktop-v2.component";

describe("VaultDesktopV2Component", () => {
  const i18nService = mock<I18nService>();
  const cipherService = mock<CipherService>();
  const folderService = mock<FolderService>();
  // 别把 Observable 传进 `mock<T>({...})`：它会递归代理嵌套对象，RxJS 的 subscribe 就失效了。
  const accountService = mock<AccountService>();
  const versionHistoryService = mock<CipherVersionHistoryService>();
  const passwordStrengthService = mock<PasswordStrengthServiceAbstraction>();
  const passwordRepromptService = mock<PasswordRepromptService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const router = { navigate: jest.fn().mockResolvedValue(true), navigateByUrl: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    i18nService.t.mockImplementation((key: string) => key);
    i18nService.locale$ = of("en");
    cipherService.getAllDecrypted.mockResolvedValue([]);
    folderService.folderViews$.mockReturnValue(of([]));
    versionHistoryService.rows.mockResolvedValue([]);
    passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 3 } as any);
    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(true);
    accountService.activeAccount$ = of({ id: "user-id" } as any);

    await TestBed.configureTestingModule({
      imports: [VaultDesktopV2Component],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: CipherService, useValue: cipherService },
        { provide: FolderService, useValue: folderService },
        { provide: TotpService, useValue: mock<TotpService>() },
        { provide: AccountService, useValue: accountService },
        { provide: CipherVersionHistoryService, useValue: versionHistoryService },
        { provide: PasswordStrengthServiceAbstraction, useValue: passwordStrengthService },
        { provide: Router, useValue: router },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
        {
          provide: PlatformUtilsService,
          useValue: platformUtilsService,
        },
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
            queryParamMap: of(convertToParamMap({})),
          },
        },
      ],
    }).compileComponents();
  });

  it("opens the type picker drawer for 新建 instead of leaving the page", async () => {
    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.includes("newItem"))?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("newItemPickKind");
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("removes a default field, adds it back, and saves the removed value as empty", async () => {
    cipherService.createWithServer.mockImplementation(async (view) => view);
    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.includes("newItem"))?.click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector(".agy-typegrid button") as HTMLButtonElement).click();
    fixture.detectChanges();

    const nameInput = fixture.nativeElement.querySelector(
      '#vault-field_name, input[placeholder="enterItemName"]',
    ) as HTMLInputElement;
    nameInput.value = "Synthetic Login";
    nameInput.dispatchEvent(new Event("input"));
    fixture.detectChanges();

    const fieldRow = (): HTMLElement | undefined =>
      (
        Array.from(
          fixture.nativeElement.querySelectorAll(".agy-drawer .agy-formrow"),
        ) as HTMLElement[]
      ).find((row) => row.textContent?.includes("username"));
    const removeField = (): void => {
      fieldRow()?.querySelector<HTMLButtonElement>('button[title="remove"]')?.click();
      fixture.detectChanges();
    };

    const username = fieldRow()?.querySelector("input") as HTMLInputElement;
    username.value = "synthetic-user";
    username.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    removeField();

    expect(fieldRow()).toBeUndefined();
    const addBack = (
      Array.from(
        fixture.nativeElement.querySelectorAll(".agy-drawer button.agy-btn.agy-sm"),
      ) as HTMLButtonElement[]
    ).find((button) => button.textContent?.includes("username"));
    expect(addBack).toBeDefined();

    addBack?.click();
    fixture.detectChanges();
    expect(fieldRow()).toBeDefined();

    const restored = fieldRow()?.querySelector("input") as HTMLInputElement;
    restored.value = "synthetic-user";
    restored.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    removeField();

    (
      fixture.nativeElement.querySelector(".agy-ext-foot .agy-primary") as HTMLButtonElement
    ).click();
    await fixture.whenStable();

    expect(cipherService.createWithServer).toHaveBeenCalled();
    const saved = cipherService.createWithServer.mock.calls[0][0];
    expect(saved.login.username).toBe("");
  });

  it("offers 新建 and 导入 when the vault is empty", async () => {
    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain("noItemsInVault");
    expect(text).toContain("newItem");
    expect(text).toContain("importData");
  });

  it("lets an older local item without an id be selected", async () => {
    const fresh = new CipherView();
    fresh.id = "fresh-id";
    fresh.name = "Fresh local item";
    const legacy = new CipherView();
    // SDK 读回旧数据时 id 可能直接缺失；列表里点这一行以前不会有任何反应。
    legacy.id = undefined as unknown as string;
    legacy.name = "Legacy local item";
    cipherService.getAllDecrypted.mockResolvedValue([fresh, legacy]);

    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(cipherService.getAllDecrypted).toHaveBeenCalled();

    const row = (
      Array.from(fixture.nativeElement.querySelectorAll("[role=option]")) as HTMLElement[]
    ).find((element) => element.textContent?.includes("Legacy local item"));
    row?.click();
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector("aside h2")?.textContent as string;
    expect(heading).toContain("Legacy local item");
  });

  it("shows saved passwords and restores one through the local save path", async () => {
    const item = new CipherView();
    item.id = "login-id";
    item.name = "Mail";
    item.type = CipherType.Login;
    item.login.password = "current-password";
    const older = new PasswordHistoryView();
    older.password = "older-password";
    older.lastUsedDate = new Date("2026-01-02T00:00:00Z");
    item.passwordHistory = [older];
    cipherService.getAllDecrypted.mockResolvedValue([item]);
    cipherService.updateWithServer.mockImplementation(async (view) => view);

    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    (Array.from(fixture.nativeElement.querySelectorAll("[role=option]")) as HTMLElement[])
      .find((element) => element.textContent?.includes("Mail"))
      ?.click();
    fixture.detectChanges();

    const historyButton = fixture.nativeElement.querySelector(
      "[data-testid=vault_button_history]",
    ) as HTMLElement;
    historyButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const drawerText = fixture.nativeElement.textContent as string;
    expect(drawerText).toContain("itemHistoryCurrent");
    expect(drawerText).toContain("passwordHistorySavedValue");

    const restore = fixture.nativeElement.querySelector(
      "[data-testid=vault_button_restore_history]",
    ) as HTMLButtonElement;
    restore.click();
    await fixture.whenStable();

    expect(cipherService.updateWithServer).toHaveBeenCalled();
    const saved = cipherService.updateWithServer.mock.calls[0][0];
    expect(saved.login.password).toBe("older-password");
  });

  it("leaves the cached item untouched when an edit fails to save", async () => {
    const item = new CipherView();
    item.id = "login-id";
    item.name = "Mail";
    item.type = CipherType.Login;
    item.login.password = "current-password";
    cipherService.getAllDecrypted.mockResolvedValue([item]);
    cipherService.updateWithServer.mockRejectedValue(new Error("local write failed"));

    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await selectOnlyItem(fixture);

    const editButton = (
      Array.from(
        fixture.nativeElement.querySelectorAll(".agy-mac-dhead button"),
      ) as HTMLButtonElement[]
    ).find((button) => button.textContent?.trim() === "edit");
    editButton?.click();
    fixture.detectChanges();

    const nameInput = fixture.nativeElement.querySelector("#vault-field_name") as HTMLInputElement;
    nameInput.value = "Renamed";
    nameInput.dispatchEvent(new Event("input"));
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector(".agy-ext-foot .agy-primary") as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(cipherService.updateWithServer).toHaveBeenCalled();
    expect(item.name).toBe("Mail");
    const component = fixture.componentInstance as unknown as {
      selected(): CipherView | null;
    };
    expect(component.selected()?.name).toBe("Mail");
    expect(fixture.nativeElement.textContent as string).toContain("unexpectedError");
  });

  it("keeps the current password when restoring password history fails", async () => {
    const item = new CipherView();
    item.id = "login-id";
    item.name = "Mail";
    item.type = CipherType.Login;
    item.login.password = "current-password";
    const older = new PasswordHistoryView();
    older.password = "older-password";
    older.lastUsedDate = new Date("2026-01-02T00:00:00Z");
    item.passwordHistory = [older];
    cipherService.getAllDecrypted.mockResolvedValue([item]);
    cipherService.updateWithServer.mockRejectedValue(new Error("local write failed"));

    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await selectOnlyItem(fixture);

    (
      fixture.nativeElement.querySelector("[data-testid=vault_button_history]") as HTMLElement
    ).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector(
        "[data-testid=vault_button_restore_history]",
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(cipherService.updateWithServer).toHaveBeenCalled();
    expect(item.login.password).toBe("current-password");
    expect(fixture.nativeElement.textContent as string).toContain("unexpectedError");
  });

  it("lists encrypted versions for a card and restores the chosen one", async () => {
    const item = new CipherView();
    item.id = "card-id";
    item.name = "Travel card";
    item.type = CipherType.Card;
    item.card.number = "4222222222222222";
    const older = new CipherView();
    older.id = "card-id";
    older.name = "Travel card";
    older.type = CipherType.Card;
    older.card.number = "4111111111111111";
    cipherService.getAllDecrypted.mockResolvedValue([item]);
    cipherService.updateWithServer.mockImplementation(async (view) => view);
    versionHistoryService.rows.mockResolvedValue([
      {
        revisionDate: new Date("2026-01-02T00:00:00Z"),
        view: older,
        changedFields: ["number"],
      },
    ]);

    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    (Array.from(fixture.nativeElement.querySelectorAll("[role=option]")) as HTMLElement[])
      .find((element) => element.textContent?.includes("Travel card"))
      ?.click();
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector("[data-testid=vault_button_history]") as HTMLElement
    ).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const drawerText = fixture.nativeElement.textContent as string;
    expect(drawerText).toContain("itemHistoryVersion");
    expect(drawerText).toContain("itemHistoryDiff");
    expect(versionHistoryService.rows).toHaveBeenCalledWith("user-id", "card-id", item);

    (
      fixture.nativeElement.querySelector(
        "[data-testid=vault_button_restore_version]",
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();

    expect(cipherService.updateWithServer).toHaveBeenCalled();
    expect(cipherService.updateWithServer.mock.calls[0][0].card.number).toBe("4111111111111111");
  });

  const selectOnlyItem = async (fixture: ComponentFixture<VaultDesktopV2Component>) => {
    const row = fixture.nativeElement.querySelector("[role=option]") as HTMLElement | null;
    row?.click();
    fixture.detectChanges();
  };

  it("offers archiving as the reversible choice in the delete dialog", async () => {
    const item = new CipherView();
    item.id = "login-id";
    item.name = "Mail";
    item.login.password = "secret";
    cipherService.getAllDecrypted.mockResolvedValue([item]);
    cipherService.updateWithServer.mockImplementation(async (view) => view);

    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await selectOnlyItem(fixture);

    (
      fixture.nativeElement.querySelector("[data-testid=vault_drawer_delete]") as HTMLElement
    ).click();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector("[data-testid=vault_delete_archive]") as HTMLElement
    ).click();
    await fixture.whenStable();

    expect(cipherService.updateWithServer).toHaveBeenCalled();
    const saved = cipherService.updateWithServer.mock.calls[0][0];
    expect(saved.archivedDate).toBeInstanceOf(Date);
    expect(cipherService.softDeleteWithServer).not.toHaveBeenCalled();
  });

  it("offers a five-second undo after moving an item to the trash", async () => {
    const item = new CipherView();
    item.id = "login-id";
    item.name = "Mail";
    item.login.password = "secret";
    cipherService.getAllDecrypted.mockResolvedValue([item]);
    cipherService.softDeleteWithServer.mockResolvedValue(undefined);
    cipherService.restoreWithServer.mockResolvedValue(undefined);

    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await selectOnlyItem(fixture);

    (
      fixture.nativeElement.querySelector("[data-testid=vault_drawer_delete]") as HTMLElement
    ).click();
    fixture.detectChanges();
    await (
      fixture.componentInstance as unknown as { confirmRemove(): Promise<void> }
    ).confirmRemove();

    const toast = TestBed.inject(LpToastService);
    expect(toast.message()).toBe("movedToTrash");
    expect(toast.action()?.label).toBe("undo");

    await toast.invokeAction();

    expect(cipherService.restoreWithServer).toHaveBeenCalledWith("login-id", "user-id");
    toast.hide();
  });

  it("keeps a protected item closed until the master password re-prompt passes", async () => {
    const item = new CipherView();
    item.id = "protected-id";
    item.name = "Protected Mail";
    item.type = CipherType.Login;
    item.reprompt = CipherRepromptType.Password;
    item.login.password = "protected-secret";
    cipherService.getAllDecrypted.mockResolvedValue([item]);
    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(false);

    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const row = (
      Array.from(fixture.nativeElement.querySelectorAll("[role=option]")) as HTMLElement[]
    ).find((element) => element.textContent?.includes("Protected Mail"));
    row?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(passwordRepromptService.passwordRepromptCheck).toHaveBeenCalledWith(item);
    expect(fixture.nativeElement.querySelector("aside h2")?.textContent ?? "").not.toContain(
      "Protected Mail",
    );
  });

  it("does not copy a protected password from the list before the re-prompt passes", async () => {
    const item = new CipherView();
    item.id = "protected-id";
    item.name = "Protected Mail";
    item.type = CipherType.Login;
    item.reprompt = CipherRepromptType.Password;
    item.login.password = "protected-secret";
    cipherService.getAllDecrypted.mockResolvedValue([item]);
    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(false);

    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('.agy-mac-row [title="copyPassword"]') as HTMLElement
    ).click();
    await fixture.whenStable();

    expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
  });
});
