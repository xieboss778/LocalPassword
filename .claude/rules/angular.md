---
paths:
  - "**/*.ts"
---

# Angular Patterns

> **Scope:** apply these rules to Angular code in the browser popup, desktop renderer, and Angular libraries. Browser background and content scripts, the Electron main process, and `libs/common/` run outside Angular; keep them free of Angular DI and decorators. See [monorepo boundaries](../../AGENTS.md#monorepo-boundaries).

Distilled from [Web Code Style — Angular](https://contributing.bitwarden.com/contributing/code-style/web/angular). Component-only patterns (templates, OnPush, signals, observable subscriptions, etc.) live in [angular-components.md](./angular-components.md); TypeScript-wide patterns live in [typescript.md](./typescript.md).

## Dependency Injection

Use `inject()` for new Angular dependencies. Outside Angular, pass dependencies explicitly through constructor parameters.

```typescript
private folderService = inject(FolderService);
```

When declaring providers (component decorator, route config, module), wrap them in `safeProvider()` from `@localpass/ui-common`. It adds compile-time checks that the implementation matches the abstraction and that the `deps` array matches the constructor — raw Angular provider objects don't.

```typescript
import { safeProvider } from "@localpass/ui-common";

providers: [
  safeProvider({
    provide: FolderService,
    useClass: DefaultFolderService,
    deps: [CipherService, I18nService],
  }),
],
```

### Injection tokens

Give every `SafeInjectionToken<T>` a specific `T` — never `Type<unknown>`, `unknown` or `any`. For a component token, declare an interface or type for the inputs the consumer binds and use `Type<ThatShape>`.

```typescript
export interface VaultGatedCollectionBanner {
  readonly organizationId: InputSignal<OrganizationId | undefined>;
}

export const VAULT_GATED_COLLECTION_BANNER = new SafeInjectionToken<
  Type<VaultGatedCollectionBanner>
>("VaultGatedCollectionBanner");
```
