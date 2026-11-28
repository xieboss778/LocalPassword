import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { LpToastService, PASSWORD_AUTO_HIDE_MS } from "@localpass/angular/local-ui";
import { CipherVersionHistoryService } from "@localpass/angular/vault/services/cipher-version-history.service";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { ClearClipboardDelay } from "@localpass/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@localpass/common/autofill/services/autofill-settings.service";
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
import { ItemKind } from "@localpass/local-vault";
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
  const autofillSettingsService = mock<AutofillSettingsServiceAbstraction>();
  const dialogService = mock<DialogService>();
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
    dialogService.openSimpleDialog.mockResolvedValue(true);
    accountService.activeAccount$ = of({ id: "user-id" } as any);
    autofillSettingsService.clearClipboardDelay$ = of(ClearClipboardDelay.ThirtySeconds);

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
        { provide: DialogService, useValue: dialogService },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
        {
          provide: PlatformUtilsService,
          useValue: platformUtilsService,
        },
        {
          provide: AutofillSettingsServiceAbstraction,
          useValue: autofillSettingsService,
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

  describe("action=add query parameter", () => {
    const openFromQuery = async (
      fixture: ComponentFixture<VaultDesktopV2Component>,
      params: Record<string, string>,
    ): Promise<void> => {
      await fixture.componentInstance["openFromQuery"](convertToParamMap(params));
    };

    const drawerState = (fixture: ComponentFixture<VaultDesktopV2Component>) => {
      const component = fixture.componentInstance;
      return {
        drawer: component["drawer"]() as string,
        newKind: component["newKind"]() as ItemKind,
        selected: component["selected"]() as CipherView | null,
      };
    };

    it("opens the new form for a valid kind and clears every query param", async () => {
      const item = new CipherView();
      item.id = "login-id";
      item.name = "Mail";
      cipherService.getAllDecrypted.mockResolvedValue([item]);

      const fixture = TestBed.createComponent(VaultDesktopV2Component);
      fixture.detectChanges();
      await fixture.whenStable();

      await openFromQuery(fixture, {
        action: "add",
        kind: ItemKind.Card,
        cipherId: "login-id",
      });

      expect(drawerState(fixture)).toEqual({
        drawer: "new-form",
        newKind: ItemKind.Card,
        selected: null,
      });
      expect(router.navigate).toHaveBeenCalledWith([], {
        relativeTo: expect.anything(),
        queryParams: { action: null, kind: null, cipherId: null, edit: null },
        queryParamsHandling: "merge",
        replaceUrl: true,
      });
    });

    it("keeps the open edit when the user declines to discard changes", async () => {
      const item = new CipherView();
      item.id = "login-id";
      item.name = "Mail";
      item.type = CipherType.Login;
      cipherService.getAllDecrypted.mockResolvedValue([item]);
      dialogService.openSimpleDialog.mockResolvedValue(false);

      const fixture = TestBed.createComponent(VaultDesktopV2Component);
      fixture.detectChanges();
      await fixture.whenStable();
      const component = fixture.componentInstance;
      await component["openView"](item);
      await component["startEdit"]();
      component["setValue"]("name", "Unsaved rename");

      await openFromQuery(fixture, { action: "add", kind: ItemKind.Card });

      expect(drawerState(fixture).drawer).toBe("edit");
      expect(component["values"]().name).toBe("Unsaved rename");
      expect(router.navigate).toHaveBeenCalledWith([], {
        relativeTo: expect.anything(),
        queryParams: { action: null, kind: null, cipherId: null, edit: null },
        queryParamsHandling: "merge",
        replaceUrl: true,
      });
    });

    it("opens the type picker when no kind is given", async () => {
      const fixture = TestBed.createComponent(VaultDesktopV2Component);
      fixture.detectChanges();
      await fixture.whenStable();

      await openFromQuery(fixture, { action: "add" });

      expect(drawerState(fixture).drawer).toBe("new-type");
    });

    it("treats an unknown kind as absent and opens the type picker", async () => {
      const fixture = TestBed.createComponent(VaultDesktopV2Component);
      fixture.detectChanges();
      await fixture.whenStable();

      await openFromQuery(fixture, { action: "add", kind: "not-a-kind" });

      expect(drawerState(fixture)).toEqual({
        drawer: "new-type",
        newKind: ItemKind.Login,
        selected: null,
      });
    });
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

  it("guards drawer close and scrim after rejecting discard, then keeps the drawer open", async () => {
    const item = new CipherView();
    item.id = "login-id";
    item.name = "Mail";
    item.type = CipherType.Login;
    cipherService.getAllDecrypted.mockResolvedValue([item]);
    dialogService.openSimpleDialog.mockResolvedValue(false);

    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await selectOnlyItem(fixture);
    (
      Array.from(
        fixture.nativeElement.querySelectorAll(".agy-mac-dhead button"),
      ) as HTMLButtonElement[]
    )
      .find((button) => button.textContent?.trim() === "edit")
      ?.click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector("#vault-field_name") as HTMLInputElement;
    input.value = "First edit";
    input.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    (
      Array.from(
        fixture.nativeElement.querySelectorAll(".agy-ext-foot button"),
      ) as HTMLButtonElement[]
    )
      .find((button) => button.textContent?.trim() === "cancel")
      ?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    (
      Array.from(
        fixture.nativeElement.querySelector(".agy-sheetwrap")?.querySelectorAll("button") ?? [],
      ) as HTMLButtonElement[]
    )
      .find((button) => button.getAttribute("aria-label") === "close")
      ?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector(".agy-drawer")).not.toBeNull();
  });

  it("keeps the open edit when the user rejects the save confirmation on delete", async () => {
    const item = new CipherView();
    item.id = "login-id";
    item.name = "Mail";
    item.type = CipherType.Login;
    cipherService.getAllDecrypted.mockResolvedValue([item]);
    dialogService.openSimpleDialog.mockResolvedValue(false);

    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await selectOnlyItem(fixture);
    (
      Array.from(
        fixture.nativeElement.querySelectorAll(".agy-mac-dhead button"),
      ) as HTMLButtonElement[]
    )
      .find((button) => button.textContent?.trim() === "edit")
      ?.click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector("#vault-field_name") as HTMLInputElement;
    input.value = "First edit";
    input.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    (
      Array.from(
        fixture.nativeElement.querySelectorAll(".agy-ext-foot button"),
      ) as HTMLButtonElement[]
    )
      .find((button) => button.textContent?.trim() === "delete")
      ?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector(".agy-drawer")).not.toBeNull();
    expect(fixture.nativeElement.querySelector("[role=dialog]")).toBeNull();
  });

  it("keeps an edit open when the user declines to discard changes", async () => {
    const item = new CipherView();
    item.id = "login-id";
    item.name = "Mail";
    item.type = CipherType.Login;
    cipherService.getAllDecrypted.mockResolvedValue([item]);
    dialogService.openSimpleDialog.mockResolvedValue(false);

    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await selectOnlyItem(fixture);

    (
      Array.from(
        fixture.nativeElement.querySelectorAll(".agy-mac-dhead button"),
      ) as HTMLButtonElement[]
    )
      .find((button) => button.textContent?.trim() === "edit")
      ?.click();
    fixture.detectChanges();

    const nameInput = fixture.nativeElement.querySelector("#vault-field_name") as HTMLInputElement;
    nameInput.value = "Renamed";
    nameInput.dispatchEvent(new Event("input"));
    fixture.detectChanges();

    (
      Array.from(
        fixture.nativeElement.querySelectorAll(".agy-ext-foot button"),
      ) as HTMLButtonElement[]
    )
      .find((button) => button.textContent?.trim() === "cancel")
      ?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: { key: "discardEditsTitle" },
        content: { key: "discardEditsConfirmation" },
        acceptButtonText: { key: "discardEdits" },
        cancelButtonText: { key: "keepEditing" },
      }),
    );
    expect(fixture.nativeElement.querySelector(".agy-drawer")).not.toBeNull();
    expect(
      (fixture.nativeElement.querySelector("#vault-field_name") as HTMLInputElement).value,
    ).toBe("Renamed");
  });

  it("blocks route deactivation when the user declines to discard an edited item", async () => {
    const item = new CipherView();
    item.id = "login-id";
    item.name = "Mail";
    item.type = CipherType.Login;
    cipherService.getAllDecrypted.mockResolvedValue([item]);
    dialogService.openSimpleDialog.mockResolvedValue(false);

    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await selectOnlyItem(fixture);
    (
      Array.from(
        fixture.nativeElement.querySelectorAll(".agy-mac-dhead button"),
      ) as HTMLButtonElement[]
    )
      .find((button) => button.textContent?.trim() === "edit")
      ?.click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector("#vault-field_name") as HTMLInputElement;
    input.value = "Unsaved navigation draft";
    input.dispatchEvent(new Event("input"));
    fixture.detectChanges();

    await expect(fixture.componentInstance.confirmNavigationAway()).resolves.toBe(false);
    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
      expect.objectContaining({ content: { key: "discardEditsConfirmation" } }),
    );
    expect(fixture.nativeElement.querySelector(".agy-drawer")).not.toBeNull();
  });

  it("closes an unchanged edit without asking to discard", async () => {
    const item = new CipherView();
    item.id = "login-id";
    item.name = "Mail";
    item.type = CipherType.Login;
    cipherService.getAllDecrypted.mockResolvedValue([item]);

    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await selectOnlyItem(fixture);

    (
      Array.from(
        fixture.nativeElement.querySelectorAll(".agy-mac-dhead button"),
      ) as HTMLButtonElement[]
    )
      .find((button) => button.textContent?.trim() === "edit")
      ?.click();
    fixture.detectChanges();
    (
      Array.from(
        fixture.nativeElement.querySelectorAll(".agy-ext-foot button"),
      ) as HTMLButtonElement[]
    )
      .find((button) => button.textContent?.trim() === "cancel")
      ?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector(".agy-drawer")).toBeNull();
  });

  it("keeps a new-item form open when the user declines to discard changes", async () => {
    dialogService.openSimpleDialog.mockResolvedValue(false);

    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector(".agy-mac-welcome button") as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector(".agy-typegrid button") as HTMLButtonElement).click();
    fixture.detectChanges();
    const nameInput = fixture.nativeElement.querySelector("#vault-field_name") as HTMLInputElement;
    nameInput.value = "Synthetic draft";
    nameInput.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    (
      Array.from(
        fixture.nativeElement.querySelectorAll(".agy-ext-foot button"),
      ) as HTMLButtonElement[]
    )
      .find((button) => button.textContent?.trim() === "cancel")
      ?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: { key: "discardEditsTitle" },
        content: { key: "discardEditsConfirmation" },
        acceptButtonText: { key: "discardEdits" },
        cancelButtonText: { key: "keepEditing" },
      }),
    );
    expect(fixture.nativeElement.querySelector(".agy-drawer")).not.toBeNull();
    expect(
      (fixture.nativeElement.querySelector("#vault-field_name") as HTMLInputElement).value,
    ).toBe("Synthetic draft");
  });

  it("closes a new-item form without prompting when it is still empty", async () => {
    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector(".agy-mac-welcome button") as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector(".agy-typegrid button") as HTMLButtonElement).click();
    fixture.detectChanges();
    (
      Array.from(
        fixture.nativeElement.querySelectorAll(".agy-ext-foot button"),
      ) as HTMLButtonElement[]
    )
      .find((button) => button.textContent?.trim() === "cancel")
      ?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector(".agy-drawer")).toBeNull();
  });

  it("discards edited values only after the user confirms", async () => {
    const item = new CipherView();
    item.id = "login-id";
    item.name = "Mail";
    item.type = CipherType.Login;
    cipherService.getAllDecrypted.mockResolvedValue([item]);
    dialogService.openSimpleDialog.mockResolvedValue(true);

    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await selectOnlyItem(fixture);

    (
      Array.from(
        fixture.nativeElement.querySelectorAll(".agy-mac-dhead button"),
      ) as HTMLButtonElement[]
    )
      .find((button) => button.textContent?.trim() === "edit")
      ?.click();
    fixture.detectChanges();

    const nameInput = fixture.nativeElement.querySelector("#vault-field_name") as HTMLInputElement;
    nameInput.value = "Renamed";
    nameInput.dispatchEvent(new Event("input"));
    fixture.detectChanges();

    (
      Array.from(
        fixture.nativeElement.querySelectorAll(".agy-ext-foot button"),
      ) as HTMLButtonElement[]
    )
      .find((button) => button.textContent?.trim() === "cancel")
      ?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector(".agy-drawer")).toBeNull();
    expect(item.name).toBe("Mail");
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

  it("uses the clipboard-clear setting for copy receipts", async () => {
    autofillSettingsService.clearClipboardDelay$ = of(ClearClipboardDelay.TenSeconds);
    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    const toast = TestBed.inject(LpToastService);
    const showClipboard = jest.spyOn(toast, "showClipboard").mockImplementation();
    const show = jest.spyOn(toast, "show").mockImplementation();

    await fixture.componentInstance["copyValue"]("bossxie", "username");

    expect(showClipboard).toHaveBeenCalledWith("valueCopied", expect.any(Function), 10);
    expect(show).not.toHaveBeenCalled();
  });

  it("keeps a copied receipt without a countdown when the setting is Never", async () => {
    autofillSettingsService.clearClipboardDelay$ = of(ClearClipboardDelay.Never);
    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    const toast = TestBed.inject(LpToastService);
    const showClipboard = jest.spyOn(toast, "showClipboard").mockImplementation();
    const show = jest.spyOn(toast, "show").mockImplementation();

    await fixture.componentInstance["copyValue"]("bossxie", "username");

    expect(show).toHaveBeenCalledWith("valueCopied");
    expect(showClipboard).not.toHaveBeenCalled();
  });

  it("does not match an item by its password or TOTP seed", () => {
    const item = new CipherView();
    item.id = "login-id";
    item.name = "Mail";
    item.type = CipherType.Login;
    item.login.username = "bossxie";
    item.login.password = "hunter2";
    item.login.totp = "JBSWY3DP";
    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    const matches = (query: string): boolean =>
      fixture.componentInstance["matchesQuery"](item, query, new Map());

    expect(matches("bossxie")).toBe(true);
    expect(matches("hunter2")).toBe(false);
    expect(matches("jbswy3dp")).toBe(false);
  });

  it("requires the re-prompt before showing the TOTP QR and keeps the seed masked", async () => {
    const item = new CipherView();
    item.id = "login-id";
    item.name = "Mail";
    item.type = CipherType.Login;
    item.reprompt = CipherRepromptType.Password;
    item.login.totp = "JBSWY3DP";
    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    fixture.componentInstance["selected"].set(item);

    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(false);
    await fixture.componentInstance["openQr"]();
    expect(fixture.componentInstance["drawer"]()).toBe("closed");

    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(true);
    await fixture.componentInstance["openQr"]();
    expect(fixture.componentInstance["drawer"]()).toBe("qr");
    expect(fixture.componentInstance["qrSecretVisible"]()).toBe(false);
  });

  it("keeps unsaved edit input when ⌘N is pressed", async () => {
    const item = new CipherView();
    item.id = "login-id";
    item.name = "Mail";
    item.type = CipherType.Login;
    item.login.username = "synthetic-user";
    cipherService.getAllDecrypted.mockResolvedValue([item]);

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
    await fixture.whenStable();
    fixture.detectChanges();

    const nameInput = fixture.nativeElement.querySelector("#vault-field_name") as HTMLInputElement;
    nameInput.value = "Unsaved rename";
    nameInput.dispatchEvent(new Event("input"));
    fixture.detectChanges();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "n", metaKey: true, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as {
      drawer(): string;
      values(): Record<string, string>;
    };
    expect(component.drawer()).toBe("edit");
    expect(component.values().name).toBe("Unsaved rename");
    expect(
      (fixture.nativeElement.querySelector("#vault-field_name") as HTMLInputElement).value,
    ).toBe("Unsaved rename");
    expect(fixture.nativeElement.textContent as string).not.toContain("newItemPickKind");
  });

  it("keeps an unsaved new item form when ⌘N is pressed", async () => {
    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const newButton = (
      Array.from(fixture.nativeElement.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((button) => button.textContent?.includes("newItem"));
    newButton?.click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector(".agy-typegrid button") as HTMLButtonElement).click();
    fixture.detectChanges();

    const nameInput = fixture.nativeElement.querySelector("#vault-field_name") as HTMLInputElement;
    nameInput.value = "Unsaved new item";
    nameInput.dispatchEvent(new Event("input"));
    fixture.detectChanges();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "n", metaKey: true, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as {
      drawer(): string;
      values(): Record<string, string>;
    };
    expect(component.drawer()).toBe("new-form");
    expect(component.values().name).toBe("Unsaved new item");
    expect(
      (fixture.nativeElement.querySelector("#vault-field_name") as HTMLInputElement).value,
    ).toBe("Unsaved new item");
  });

  it("opens the new item type picker with ⌘N when no form drawer is open", async () => {
    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "n", metaKey: true, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as { drawer(): string };
    expect(component.drawer()).toBe("new-type");
    expect(fixture.nativeElement.textContent as string).toContain("newItemPickKind");
  });

  it("hides a revealed QR seed and history password after the auto-hide interval", () => {
    const fixture = TestBed.createComponent(VaultDesktopV2Component);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    jest.useFakeTimers();
    component["toggleQrSecret"]();
    component["toggleHistoryReveal"](-1);
    expect(component["qrSecretVisible"]()).toBe(true);
    expect(component["historyRevealed"]().has(-1)).toBe(true);

    jest.advanceTimersByTime(PASSWORD_AUTO_HIDE_MS);
    expect(component["qrSecretVisible"]()).toBe(false);
    expect(component["historyRevealed"]().has(-1)).toBe(false);
    jest.useRealTimers();
  });
});
