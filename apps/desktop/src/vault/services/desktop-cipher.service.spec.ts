import { mock } from "jest-mock-extended";
import { firstValueFrom, Observable, of } from "rxjs";

import { ApiService } from "@localpass/common/abstractions/api.service";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { AutofillSettingsServiceAbstraction } from "@localpass/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@localpass/common/autofill/services/domain-settings.service";
import { ConfigService } from "@localpass/common/platform/abstractions/config/config.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { StateProvider } from "@localpass/common/platform/state";
import { UserId } from "@localpass/common/types/guid";
import { CipherEncryptionService } from "@localpass/common/vault/abstractions/cipher-encryption.service";
import { CipherSdkService } from "@localpass/common/vault/abstractions/cipher-sdk.service";
import { CipherFileUploadService } from "@localpass/common/vault/abstractions/file-upload/cipher-file-upload.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { KeyService } from "@localpass/key-management";

import { DesktopCipherService } from "./desktop-cipher.service";

type CtorArgs = ConstructorParameters<typeof DesktopCipherService>;

class TestDesktopCipherService extends DesktopCipherService {
  setFullViews(views$: (userId: UserId) => Observable<CipherView[] | null>) {
    this.cipherViewsIncludingRestricted$ = views$;
  }
}

describe("DesktopCipherService", () => {
  const userId = "user-id" as UserId;
  const cipherEncryptionService = mock<CipherEncryptionService>();
  let service: TestDesktopCipherService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new TestDesktopCipherService(
      mock<KeyService>(),
      mock<CtorArgs[1]>(),
      mock<DomainSettingsService>(),
      mock<ApiService>(),
      mock<I18nService>(),
      mock<AutofillSettingsServiceAbstraction>(),
      mock<CtorArgs[6]>(),
      mock<CipherFileUploadService>(),
      mock<ConfigService>(),
      mock<StateProvider>(),
      mock<AccountService>(),
      mock<LogService>(),
      cipherEncryptionService,
      mock<CipherSdkService>(),
    );
  });

  it("emits list views from the full-view decrypt", async () => {
    const views = [new CipherView()];
    service.setFullViews(() => of(views));

    expect(await firstValueFrom(service.cipherListViewsIncludingRestricted$(userId))).toBe(views);
    expect(await firstValueFrom(service.cipherListViews$(userId))).toEqual(views);
    expect(cipherEncryptionService.decryptManyWithFailures).not.toHaveBeenCalled();
  });

  it("passes through null while decryption is in progress", async () => {
    service.setFullViews(() => of(null));

    expect(await firstValueFrom(service.cipherListViews$(userId))).toBeNull();
  });
});
