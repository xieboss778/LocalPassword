import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";

import { GlobalStateProvider } from "@localpass/common/platform/state";
import { FakeGlobalStateProvider } from "@localpass/common/spec";

import { VaultDensity, VaultDensityService } from "./vault-density.service";

describe("VaultDensityService", () => {
  let sut: VaultDensityService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        VaultDensityService,
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
      ],
    });
    sut = TestBed.inject(VaultDensityService);
  });

  it("defaults to the compact density", async () => {
    expect(await firstValueFrom(sut.density$)).toBe(VaultDensity.Compact);
  });

  it("persists and emits the selected density", async () => {
    await sut.setDensity(VaultDensity.Ultra);

    expect(await firstValueFrom(sut.density$)).toBe(VaultDensity.Ultra);
  });
});
