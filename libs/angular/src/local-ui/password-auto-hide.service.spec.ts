import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";

import { GlobalStateProvider } from "@localpass/common/platform/state";
import { FakeGlobalStateProvider } from "@localpass/common/spec";

import { PasswordAutoHideService } from "./password-auto-hide.service";

describe("PasswordAutoHideService", () => {
  let sut: PasswordAutoHideService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PasswordAutoHideService,
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
      ],
    });
    sut = TestBed.inject(PasswordAutoHideService);
  });

  it("hides revealed values by default", async () => {
    expect(await firstValueFrom(sut.autoHide$)).toBe(true);
  });

  it("persists the user's choice", async () => {
    await sut.setAutoHide(false);

    expect(await firstValueFrom(sut.autoHide$)).toBe(false);
  });
});
