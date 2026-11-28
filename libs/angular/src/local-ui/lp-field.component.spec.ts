import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";

import { LpFieldComponent, LpFieldOption } from "./lp-field.component";

const OPTIONS: readonly LpFieldOption[] = [
  { value: "Production", label: "Production" },
  { value: "Staging", label: "Staging" },
];

describe("LpFieldComponent", () => {
  let fixture: ComponentFixture<LpFieldComponent>;
  let component: LpFieldComponent;
  const i18nService = mock<I18nService>();

  beforeEach(async () => {
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [LpFieldComponent],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(LpFieldComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("label", "Environment");
    fixture.componentRef.setInput("layout", "row");
    fixture.componentRef.setInput("options", OPTIONS);
    fixture.componentRef.setInput("allowCustom", true);
    fixture.componentRef.setInput("value", "");
    fixture.detectChanges();
  });

  it("switches to free text when Custom is chosen and returns to the first preset", () => {
    const select = fixture.nativeElement.querySelector("select") as HTMLSelectElement;
    const custom = Array.from(select.options).find((option) => option.text === "custom");
    expect(custom).toBeDefined();

    select.value = custom!.value;
    select.dispatchEvent(new Event("change"));
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe("");

    input.value = "On-premise";
    input.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    expect(component.value()).toBe("On-premise");

    const back = fixture.nativeElement.querySelector(
      'button[aria-label="options"]',
    ) as HTMLButtonElement;
    back.click();
    fixture.detectChanges();

    expect(component.value()).toBe("Production");
    expect(fixture.nativeElement.querySelector("select")).toBeDefined();
  });

  it("opens in free text when the saved value is not one of the presets", () => {
    fixture.componentRef.setInput("value", "On-premise");
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("On-premise");
    expect(fixture.nativeElement.querySelector("select")).toBeNull();
  });

  // A static `id` also lands on the host element, which made the host and the inner
  // control share an id. Automation and assistive technology then saw two matches.
  it("keeps the field id on the inner control only", () => {
    fixture.componentRef.setInput("id", "export_input_password");
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const control = host.querySelector("select");

    expect(host.getAttribute("id")).toBeNull();
    expect(control?.id).toBe("export_input_password");
  });
});
