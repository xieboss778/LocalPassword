import { CipherType } from "@localpass/common/vault/enums/cipher-type";
import { FieldType } from "@localpass/common/vault/enums/field-type.enum";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { FieldView } from "@localpass/common/vault/models/view/field.view";
import { LoginUriView } from "@localpass/common/vault/models/view/login-uri.view";
import { PasswordHistoryView } from "@localpass/common/vault/models/view/password-history.view";

import { cloneCipherView } from "./cipher-clone";

const OLDER_DATE = new Date("2025-12-31T00:00:00Z");

describe("cloneCipherView", () => {
  function source(): CipherView {
    const item = new CipherView();
    item.id = "cipher-id";
    item.name = "Mail";
    item.type = CipherType.Login;
    item.favorite = true;
    item.revisionDate = new Date("2026-01-02T03:04:05Z");
    item.login.username = "user@example.com";
    item.login.password = "current-password";

    const uri = new LoginUriView();
    uri.uri = "https://example.com";
    item.login.uris = [uri];

    const field = new FieldView();
    field.name = "PIN";
    field.value = "1234";
    field.type = FieldType.Text;
    item.fields = [field];

    const history = new PasswordHistoryView();
    history.password = "older-password";
    history.lastUsedDate = OLDER_DATE;
    item.passwordHistory = [history];

    return item;
  }

  it("preserves the item's values and dates", () => {
    const item = source();

    const clone = cloneCipherView(item);

    expect(clone.id).toBe(item.id);
    expect(clone.name).toBe(item.name);
    expect(clone.type).toBe(item.type);
    expect(clone.favorite).toBe(true);
    expect(clone.revisionDate).toEqual(item.revisionDate);
    expect(clone.login.username).toBe("user@example.com");
    expect(clone.login.password).toBe("current-password");
    expect(clone.login.uris[0].uri).toBe("https://example.com");
    expect(clone.fields[0].value).toBe("1234");
    expect(clone.passwordHistory[0].password).toBe("older-password");
    expect(clone.passwordHistory[0].lastUsedDate).toEqual(OLDER_DATE);
  });

  it("does not share nested views with the original", () => {
    const item = source();

    const clone = cloneCipherView(item);
    clone.login.password = "edited";
    clone.login.uris[0].uri = "https://changed.example.com";
    clone.fields[0].value = "9999";
    clone.passwordHistory[0].password = "rewritten";

    expect(item.login.password).toBe("current-password");
    expect(item.login.uris[0].uri).toBe("https://example.com");
    expect(item.fields[0].value).toBe("1234");
    expect(item.passwordHistory[0].password).toBe("older-password");
  });
});
