---
paths:
  - "libs/common/src/vault/models/domain/**"
  - "libs/common/src/vault/models/view/**"
  - "libs/common/src/vault/models/data/**"
  - "libs/common/src/vault/services/cipher.service.ts"
  - "libs/common/src/vault/abstractions/cipher.service.ts"
---

# Vault SDK Sync

The installed `@localpass/sdk-internal` dependency defines what survives a `toSdk`/`fromSdk` round trip. A field added only to a TypeScript model can disappear on conversion. The Rust paths below identify the corresponding SDK types; they are not files to edit in this repository.

## Model Changes

When a model field is added, removed, renamed, or retyped:

- Check the corresponding type in the installed SDK. If a persisted field needs an SDK or encrypted-format change, stop and discuss it with the maintainer before implementation. Do not add a parallel serialization or encryption path.
- For a supported field, update both `toSdk*` and `fromSdk*` (or `toSdkLocalData` and `fromSdkLocalData` for `LocalData`). Add a round-trip test with synthetic values so a dropped field fails the test.

| Model (`libs/common/src/vault/`)                                                                            | SDK file (`crates/bitwarden-vault/src/`) |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `models/domain/cipher.ts`, `models/view/cipher.view.ts`, `models/data/cipher.data.ts`                       | `cipher/cipher.rs`                       |
| `attachment`                                                                                                | `cipher/attachment.rs`                   |
| `bank-account`                                                                                              | `cipher/bank_account.rs`                 |
| `card`                                                                                                      | `cipher/card.rs`                         |
| `drivers-license`                                                                                           | `cipher/drivers_license.rs`              |
| `field`                                                                                                     | `cipher/field.rs`                        |
| `identity`                                                                                                  | `cipher/identity.rs`                     |
| `login`, `login-uri`, `fido2-credential`                                                                    | `cipher/login.rs`                        |
| `passport`                                                                                                  | `cipher/passport.rs`                     |
| `secure-note`                                                                                               | `cipher/secure_note.rs`                  |
| `ssh-key`                                                                                                   | `cipher/ssh_key.rs`                      |
| `models/domain/password.ts`, `models/view/password-history.view.ts`, `models/data/password-history.data.ts` | `password_history.rs`                    |
| `models/data/local.data.ts`                                                                                 | `cipher/local_data.rs`                   |

Rows without a path cover `models/domain/<name>.ts`, `models/view/<name>.view.ts`, and `models/data/<name>.data.ts`. Data models round-trip to the SDK through `CipherRecordMapper` (`models/domain/cipher-sdk-mapper.ts`).

## CipherService

- Local account writes go through `LocalVaultWriter`; use the existing `CipherEncryptionService` for encryption and decryption. SDK-backed operations belong in `CipherSdkService`.
- Flag new `CipherService` methods that call `ApiService` or `EncryptService` directly. A failed local write must not fall back to a server request.
