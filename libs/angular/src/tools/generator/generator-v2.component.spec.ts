import { TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Account, AccountService } from "@localpass/common/auth/abstractions/account.service";
import { ClearClipboardDelay } from "@localpass/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@localpass/common/autofill/services/autofill-settings.service";
import { ClearClipboardDelaySetting } from "@localpass/common/autofill/types";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { Type } from "@localpass/generator-core";
import { GeneratedCredential, GeneratorHistoryService } from "@localpass/generator-history";

import { LpToastService } from "../../local-ui";

import { GeneratorV2Component } from "./generator-v2.component";

describe("GeneratorV2Component copy receipts", () => {
  const i18nService = mock<I18nService>();
  const toast = mock<LpToastService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const accountService = mock<AccountService>();
  const generatorHistoryService = mock<GeneratorHistoryService>();
  const logService = mock<LogService>();
  const autofillSettingsService = mock<AutofillSettingsServiceAbstraction>();

  const setClearDelay = (delay: ClearClipboardDelaySetting) => {
    autofillSettingsService.clearClipboardDelay$ = of(delay);
  };

  const createComponent = () => {
    const fixture = TestBed.createComponent(GeneratorV2Component);
    return fixture.componentInstance;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    i18nService.t.mockImplementation((key: string, p1?: string | number) =>
      p1 === undefined ? key : `${key} ${p1}`,
    );
    platformUtilsService.copyToClipboard.mockReturnValue(true);
    accountService.activeAccount$ = of({
      id: "user-id",
      email: "user@example.com",
      emailVerified: true,
      name: undefined,
      creationDate: undefined,
    } as Account);
    generatorHistoryService.credentials$.mockReturnValue(of([]));
    generatorHistoryService.track.mockResolvedValue(null);
    setClearDelay(ClearClipboardDelay.TenSeconds);

    await TestBed.configureTestingModule({
      imports: [GeneratorV2Component],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: LpToastService, useValue: toast },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: AccountService, useValue: accountService },
        { provide: GeneratorHistoryService, useValue: generatorHistoryService },
        { provide: LogService, useValue: logService },
        { provide: AutofillSettingsServiceAbstraction, useValue: autofillSettingsService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { compact: true } }, queryParamMap: of(null) },
        },
      ],
    })
      .overrideComponent(GeneratorV2Component, {
        set: { template: "", imports: [] },
      })
      .compileComponents();
  });

  it("uses the global clear delay instead of the implicit 30 seconds", async () => {
    const component = createComponent();

    (component as any).copy("s3cret");

    expect(toast.showClipboard).toHaveBeenCalledTimes(1);
    const [message, onClearNow, seconds] = toast.showClipboard.mock.calls[0];
    expect(message).toBe("valueCopied password");
    expect(seconds).toBe(10);
    expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("s3cret", expect.anything());
    expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalledWith("", expect.anything());

    platformUtilsService.readFromClipboard.mockResolvedValue("s3cret");
    await onClearNow();

    expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("", { clearing: true });
  });

  it("keeps a newer clipboard value when the receipt clear fires", async () => {
    const component = createComponent();

    (component as any).copy("s3cret");

    const onClearNow = toast.showClipboard.mock.calls[0][1];
    platformUtilsService.readFromClipboard.mockResolvedValue("copied later");
    await onClearNow();

    expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalledWith("", expect.anything());
  });

  it("shows a plain toast and schedules no clear when the setting is never", () => {
    setClearDelay(ClearClipboardDelay.Never);
    const component = createComponent();

    (component as any).copy("s3cret");

    expect(toast.show).toHaveBeenCalledWith("valueCopied password");
    expect(toast.showClipboard).not.toHaveBeenCalled();
  });

  it("applies the configured delay to copied history entries", () => {
    const component = createComponent();
    const credential = new GeneratedCredential("s3cret", Type.password, new Date(), "password");

    (component as any).copyHistory(credential);

    expect(toast.showClipboard).toHaveBeenCalledWith(
      "valueCopied password",
      expect.any(Function),
      10,
    );
    expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("s3cret", expect.anything());
  });

  it("still records a copied generated value", async () => {
    const component = createComponent();

    (component as any).copy("s3cret");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(generatorHistoryService.track).toHaveBeenCalledWith(
      "user-id",
      "s3cret",
      Type.password,
      expect.any(Date),
      "password",
    );
  });

  it("ignores an empty value", () => {
    const component = createComponent();

    (component as any).copy("");

    expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
    expect(toast.showClipboard).not.toHaveBeenCalled();
    expect(toast.show).not.toHaveBeenCalled();
  });
});
