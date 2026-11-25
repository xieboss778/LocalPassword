import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { CollectionService } from "@localpass/admin-console/common";
import { OrganizationService } from "@localpass/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { mockAccountInfoWith } from "@localpass/common/spec";
import { CipherId, UserId } from "@localpass/common/types/guid";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@localpass/common/vault/enums";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { ToastService } from "@localpass/components";
import { LogService } from "@localpass/logging";
import { SendPolicyService } from "@localpass/send-ui";
import { ShareLinkService } from "@localpass/tools-share";

import { PopupRouterCacheService } from "../../../platform/popup/view-cache/popup-router-cache.service";

import { ShareItemComponent } from "./share-item.component";

describe("ShareItemComponent", () => {
  let component: ShareItemComponent;
  let fixture: ComponentFixture<ShareItemComponent>;
  let cipherService: MockProxy<CipherService>;

  const queryParams$ = new BehaviorSubject<Record<string, string>>({
    cipherId: "cipher-123" as CipherId,
  });

  const mockCipher = Object.assign(new CipherView(), {
    id: "cipher-123",
    name: "Test Login",
    type: CipherType.Login,
    login: { username: "user@example.com", uris: [] },
  });

  const mockUserId = "user-123" as UserId;

  beforeEach(async () => {
    cipherService = mock<CipherService>();
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    cipherService.cipherView$.mockReturnValue(of(mockCipher));

    const collectionService = mock<CollectionService>();
    collectionService.decryptedCollections$.mockReturnValue(of([]));

    const folderService = mock<FolderService>();
    folderService.folderViews$.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, ShareItemComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { queryParams: queryParams$ },
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({
              id: mockUserId,
              ...mockAccountInfoWith({
                email: "test@email.com",
                name: "Test User",
              }),
            }),
          },
        },
        { provide: CipherService, useValue: cipherService },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: i18nService },
        { provide: ShareLinkService, useValue: { links$: of([]), setCipher: () => {} } },
        {
          provide: SendPolicyService,
          useValue: { deletionDatePolicyInfo$: of([]), allowedDomains$: of([]) },
        },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: CollectionService, useValue: collectionService },
        { provide: FolderService, useValue: folderService },
        {
          provide: PopupRouterCacheService,
          useValue: mock<PopupRouterCacheService>(),
        },
        {
          provide: OrganizationService,
          useValue: mock<OrganizationService>(),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should load cipher from route query params", () => {
    expect(cipherService.cipherView$).toHaveBeenCalledWith(mockUserId, "cipher-123");
  });

  it("should set cipher signal after loading from route", () => {
    expect(component["cipher"]()).toEqual(mockCipher);
  });
});
