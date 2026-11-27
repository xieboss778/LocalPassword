import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { TotpService } from "@localpass/common/vault/abstractions/totp.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { DialogService } from "@localpass/components";

import { VaultDesktopV2Component } from "./vault-desktop-v2.component";

describe("VaultDesktopV2Component", () => {
  const i18nService = mock<I18nService>();
  const cipherService = mock<CipherService>();
  const folderService = mock<FolderService>();
  // 别把 Observable 传进 `mock<T>({...})`：它会递归代理嵌套对象，RxJS 的 subscribe 就失效了。
  const accountService = mock<AccountService>();
  const router = { navigate: jest.fn().mockResolvedValue(true), navigateByUrl: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    i18nService.t.mockImplementation((key: string) => key);
    i18nService.locale$ = of("en");
    cipherService.getAllDecrypted.mockResolvedValue([]);
    folderService.folderViews$.mockReturnValue(of([]));
    accountService.activeAccount$ = of({ id: "user-id" } as any);

    await TestBed.configureTestingModule({
      imports: [VaultDesktopV2Component],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: CipherService, useValue: cipherService },
        { provide: FolderService, useValue: folderService },
        { provide: TotpService, useValue: mock<TotpService>() },
        { provide: AccountService, useValue: accountService },
        { provide: Router, useValue: router },
        { provide: DialogService, useValue: mock<DialogService>() },
        {
          provide: PlatformUtilsService,
          useValue: mock<PlatformUtilsService>(),
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
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
      Array.from(fixture.nativeElement.querySelectorAll("[role=row]")) as HTMLElement[]
    ).find((element) => element.textContent?.includes("Legacy local item"));
    row?.click();
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector("aside h2")?.textContent as string;
    expect(heading).toContain("Legacy local item");
  });
});
