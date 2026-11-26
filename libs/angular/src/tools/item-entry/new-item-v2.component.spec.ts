import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { ItemKind } from "@localpass/local-vault";

import { NewItemV2Component } from "./new-item-v2.component";

describe("NewItemV2Component", () => {
  const i18nService = mock<I18nService>();
  const router = { navigate: jest.fn().mockResolvedValue(true) };

  const setup = async (next?: string) => {
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [NewItemV2Component],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {},
              queryParamMap: convertToParamMap(next ? { next } : {}),
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(NewItemV2Component);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    router.navigate.mockClear();
  });

  it("forwards the entry page's next target to the form", async () => {
    const fixture = await setup("/vault");

    fixture.nativeElement.querySelectorAll("button")[0].click();

    expect(router.navigate).toHaveBeenCalledWith(["/edit-item-v2"], {
      queryParams: { kind: ItemKind.Login, next: "/vault" },
    });
  });

  it("keeps the form's own default when the entry page has no next target", async () => {
    const fixture = await setup();

    fixture.nativeElement.querySelectorAll("button")[0].click();

    expect(router.navigate).toHaveBeenCalledWith(["/edit-item-v2"], {
      queryParams: { kind: ItemKind.Login },
    });
  });
});
