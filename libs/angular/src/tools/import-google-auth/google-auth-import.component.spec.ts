import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherType } from "@localpass/common/vault/enums";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { LoginView } from "@localpass/common/vault/models/view/login.view";
import { ItemKind, kindOf } from "@localpass/local-vault";

import { GoogleAuthImportComponent } from "./google-auth-import.component";

function varint(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value;
  while (remaining > 0x7f) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining = Math.floor(remaining / 128);
  }
  bytes.push(remaining);
  return bytes;
}

function bytesField(number: number, value: Uint8Array): number[] {
  return [...varint((number << 3) | 2), ...varint(value.length), ...Array.from(value)];
}

function stringField(number: number, value: string): number[] {
  return bytesField(number, new TextEncoder().encode(value));
}

function encodeOtp(secret: string, name: string, issuer: string): number[] {
  return [
    ...bytesField(1, new TextEncoder().encode(secret)),
    ...stringField(2, name),
    ...stringField(3, issuer),
    ...varint((4 << 3) | 0),
    1,
    ...varint((5 << 3) | 0),
    1,
    ...varint((6 << 3) | 0),
    2,
  ];
}

function migrationUri(entries: { secret: string; name: string; issuer: string }[]): string {
  const body: number[] = [];
  for (const entry of entries) {
    body.push(...bytesField(1, new Uint8Array(encodeOtp(entry.secret, entry.name, entry.issuer))));
  }
  body.push(...varint((2 << 3) | 0), 1);
  const base64 = Buffer.from(String.fromCharCode(...body), "binary")
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `otpauth-migration://offline?data=${base64}`;
}

describe("GoogleAuthImportComponent", () => {
  const i18nService = mock<I18nService>();
  const cipherService = mock<CipherService>();
  const accountService = mock<AccountService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const router = { navigateByUrl: jest.fn().mockResolvedValue(true) };

  let fixture: ComponentFixture<GoogleAuthImportComponent>;
  let sut: GoogleAuthImportComponent;

  const text = (): string => (fixture.nativeElement.textContent ?? "").replace(/\s+/g, " ");
  const button = (label: string): HTMLButtonElement | undefined =>
    (Array.from(fixture.nativeElement.querySelectorAll("button")) as HTMLButtonElement[]).find(
      (candidate) => candidate.textContent?.includes(label),
    );

  const enterCodes = async (uri: string): Promise<void> => {
    const textarea = fixture.nativeElement.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = uri;
    textarea.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    button("importPreview")?.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    i18nService.t.mockImplementation((key: string) => key);
    cipherService.getAllDecrypted.mockResolvedValue([]);
    cipherService.createWithServer.mockImplementation(async (view) => view);
    accountService.activeAccount$ = of({ id: "user-id" } as any);

    await TestBed.configureTestingModule({
      imports: [GoogleAuthImportComponent],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: CipherService, useValue: cipherService },
        { provide: AccountService, useValue: accountService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GoogleAuthImportComponent);
    sut = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("previews pasted codes and marks secrets already in the vault as duplicates", async () => {
    const existing = new CipherView();
    existing.type = CipherType.Login;
    existing.login = new LoginView();
    existing.login.totp = "otpauth://totp/GitHub:owner?secret=JBSWY3DP";
    cipherService.getAllDecrypted.mockResolvedValue([existing]);

    await enterCodes(
      migrationUri([
        { secret: "abcdefgh", name: "owner@example.com", issuer: "GitHub" },
        { secret: "Hello", name: "other@example.com", issuer: "GitLab" },
      ]),
    );

    const rows = (sut as unknown as { rows: () => { duplicate: boolean }[] }).rows();
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.duplicate)).toHaveLength(1);
    expect(text()).toContain("importDuplicate");
    expect(text()).toContain("importSkip");
    expect(text()).not.toContain("otpauth://");
    expect(text()).not.toContain("MFRGGZDF");
  });

  it("imports only the selected, non-duplicate token and stores it as a token item", async () => {
    const existing = new CipherView();
    existing.type = CipherType.Login;
    existing.login = new LoginView();
    existing.login.totp = "otpauth://totp/GitHub:owner?secret=JBSWY3DP";
    cipherService.getAllDecrypted.mockResolvedValue([existing]);

    await enterCodes(
      migrationUri([
        { secret: "abcdefgh", name: "owner@example.com", issuer: "GitHub" },
        { secret: "Hello", name: "other@example.com", issuer: "GitLab" },
      ]),
    );

    button("importSelected")?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(cipherService.createWithServer).toHaveBeenCalledTimes(1);
    const saved = cipherService.createWithServer.mock.calls[0][0];
    expect(saved.name).toBe("GitHub (owner@example.com)");
    expect(saved.login?.username).toBe("owner@example.com");
    expect(saved.login?.totp).toContain("otpauth://totp/");
    expect(kindOf(saved)).toBe(ItemKind.Token);
    expect(text()).toContain("importDone");

    button("continue")?.click();
    expect(router.navigateByUrl).toHaveBeenCalledWith("/vault");
  });

  it("returns to the configured back route from the input step", () => {
    fixture.componentRef.setInput("backRoute", "/import");
    fixture.detectChanges();

    button("back")?.click();

    expect(router.navigateByUrl).toHaveBeenCalledWith("/import");
  });
});
