import { TestBed } from "@angular/core/testing";
import { RouterStateSnapshot } from "@angular/router";
import { firstValueFrom, NEVER, Observable, of, throwError } from "rxjs";

import { ConfigService } from "@localpass/common/platform/abstractions/config/config.service";

import { VaultPopupItemsService } from "../services/vault-popup-items.service";
import { VaultPopupListFiltersService } from "../services/vault-popup-list-filters.service";

import { clearVaultStateGuard } from "./clear-vault-state.guard";

describe("clearVaultStateGuard", () => {
  let applyFilterSpy: jest.Mock;
  let resetFilterFormSpy: jest.Mock;

  const setupModule = (
    vfo1Enabled: boolean,
    featureFlag$: Observable<boolean> = of(vfo1Enabled),
  ) => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: VaultPopupItemsService,
          useValue: { applyFilter: applyFilterSpy },
        },
        {
          provide: VaultPopupListFiltersService,
          useValue: { resetFilterForm: resetFilterFormSpy },
        },
        {
          provide: ConfigService,
          useValue: { getFeatureFlag$: () => featureFlag$ },
        },
      ],
    });
  };

  beforeEach(() => {
    applyFilterSpy = jest.fn();
    resetFilterFormSpy = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    "/view-cipher?cipherId=123",
    "/edit-cipher?cipherId=123",
    "/clone-cipher?cipherId=123",
    "/assign-collections?cipherId=123",
  ])("should not clear vault state when viewing or editing a cipher: %s", (url) => {
    setupModule(true);
    const nextState = { url } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() =>
      clearVaultStateGuard({}, null, null, nextState),
    );

    expect(result).toBe(true);
    expect(applyFilterSpy).not.toHaveBeenCalled();
  });

  it("should not clear vault state when not changing states", () => {
    setupModule(true);

    const result = TestBed.runInInjectionContext(() => clearVaultStateGuard({}, null, null, null));

    expect(result).toBe(true);
    expect(applyFilterSpy).not.toHaveBeenCalled();
  });

  describe("VFO1 enabled", () => {
    beforeEach(() => setupModule(true));

    it.each(["/settings", "/tabs/settings"])(
      "should not clear vault state, since VFO1 persists it: %s",
      async (url) => {
        const nextState = { url } as RouterStateSnapshot;

        const result = TestBed.runInInjectionContext(() =>
          clearVaultStateGuard({}, null, null, nextState),
        );

        expect(await firstValueFrom(result as Observable<boolean>)).toBe(true);
        expect(applyFilterSpy).not.toHaveBeenCalled();
        expect(resetFilterFormSpy).not.toHaveBeenCalled();
      },
    );
  });

  describe("VFO1 disabled", () => {
    beforeEach(() => setupModule(false));

    it.each(["/settings", "/tabs/settings"])(
      "should clear vault state when navigating to non-cipher routes: %s",
      async (url) => {
        const nextState = { url } as RouterStateSnapshot;

        const result = TestBed.runInInjectionContext(() =>
          clearVaultStateGuard({}, null, null, nextState),
        );

        expect(await firstValueFrom(result as Observable<boolean>)).toBe(true);
        expect(applyFilterSpy).toHaveBeenCalledWith("");
        expect(resetFilterFormSpy).toHaveBeenCalled();
      },
    );
  });

  describe("when the feature flag is unavailable", () => {
    afterEach(() => jest.useRealTimers());

    it("should not block navigation while waiting for the VFO1 flag", async () => {
      setupModule(false, NEVER);
      jest.useFakeTimers();
      const nextState = { url: "/tabs/settings" } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() =>
        clearVaultStateGuard({}, null, null, nextState),
      );
      const navigation = firstValueFrom(result as Observable<boolean>);
      jest.advanceTimersByTime(250);

      expect(await navigation).toBe(true);
      expect(applyFilterSpy).toHaveBeenCalledWith("");
      expect(resetFilterFormSpy).toHaveBeenCalled();
    });

    it("should not block navigation when reading the VFO1 flag fails", async () => {
      setupModule(
        false,
        throwError(() => new Error("config unavailable")),
      );
      const nextState = { url: "/tabs/settings" } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() =>
        clearVaultStateGuard({}, null, null, nextState),
      );

      expect(await firstValueFrom(result as Observable<boolean>)).toBe(true);
      expect(applyFilterSpy).toHaveBeenCalledWith("");
      expect(resetFilterFormSpy).toHaveBeenCalled();
    });
  });
});
