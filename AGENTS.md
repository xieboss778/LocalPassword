# LocalPass Agent Instructions

These instructions apply to every agent working in this repository. More specific
`AGENTS.md` files and direct user instructions take precedence.

## Project Identity

- Product name: **LocalPass**; repository: `LocalPassword`.
- This is an independent project. Some code has Bitwarden origins, but the official
  Bitwarden repository, plugins, marketplaces, issue trackers, and delivery workflows
  are not authoritative here.
- Use `origin` only: `https://github.com/xieboss778/LocalPass.git`.

## Required Workflow

1. Inspect the target app or library and nearby code before editing.
2. Load every applicable skill with the `skill` tool before acting. Catalog summaries
   are routing hints, not skill instructions.
3. For UI work, load `ui-ux-pro-max`. For Angular implementation, also load
   `writing-client-code`; load `angular-modernization` only for migration work.
4. Make the smallest change that satisfies the request. Preserve unrelated user work.
5. Validate the changed surface and report the exact commands and observed results.

## Security Guardrails

- Use synthetic examples for vault data, passwords, keys, tokens, and personal data.
- Keep sensitive values out of logs, errors, screenshots, search queries, persisted
  design files, commits, and external services.
- Add no new encryption logic. Escalate significant encryption or key-handling changes
  to the repository owner before implementation.
- Commit no secrets or credentials.

## Monorepo Boundaries

- `apps/<client>/` contains client-specific code.
- `libs/common/` is shared with non-Angular clients: no Angular decorators, `inject()`,
  `@Injectable`, or template-only APIs.
- `libs/angular/` may contain Angular APIs shared by browser and desktop.
- Place new code as deep and narrow as possible. Promote to `libs/` only when a second
  client needs it.
- Respect `eslint.config.mjs`, `nx.json`, and each app/library's TypeScript and Jest config.

## Angular and Styling

- Use standalone components, signals, `input()`/`output()`, and built-in control flow
  for new Angular code.
- Use `inject()` for new Angular dependency injection.
- Tailwind utilities always use the `tw-` prefix. Use semantic theme tokens such as
  `tw-bg-background-alt2` and `tw-text-main`; avoid arbitrary values and raw palette colors.
- The canonical theme is `libs/components/tailwind.config.base.js`.
- Reuse existing components from `libs/components/` before creating new primitives.
- User-visible strings use the project's i18n pipe and locale files.

## Documentation

- The documentation index is `docs/README.md`. Read the docs relevant to the area you
  are changing before editing, and update them in the same change when behavior, paths,
  commands, or status change.
- One source of truth per fact. Delete superseded docs instead of keeping duplicates;
  git history preserves them.
- Mark unimplemented designs as `待评审 / 未实施` in the document header. Never describe
  a proposal as current behavior.
- Use `GLOSSARY.md` terms: `同步` is the encrypted snapshot mirror, `导出` is the standard
  JSON export, `恢复` rebuilds the account. Do not use `备份` as a mechanism name.

## Scoped References

DeepSeek Harness does not auto-load `.claude/rules/` or `.dsh/rules/`. Read the relevant
local rule before editing that area; do not fetch upstream documentation as a substitute.

| Work area                             | Read                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------ |
| Angular services, routes, DI          | `.claude/rules/angular.md`                                               |
| Angular components and templates      | `.claude/rules/angular-components.md`                                    |
| TypeScript-wide changes               | `.claude/rules/typescript.md`                                            |
| HTML, templates, component styles     | `.claude/rules/tailwind.md`                                              |
| Specs and mocks                       | `.claude/rules/testing.md`                                               |
| Locale strings                        | `.claude/rules/i18n.md`                                                  |
| Storybook stories                     | `.claude/rules/storybook-routing.md`, `.claude/rules/storybook-dates.md` |
| Browser autofill content scripts      | `.claude/rules/autofill-content-scripts.md`                              |
| Vault model or cipher-service changes | `.claude/rules/vault-sdk-sync.md`                                        |

## Verification

For localized changes, scope linting and formatting to touched files:

```bash
npx eslint <changed-files> --fix
npx prettier --write <changed-files>
npm run test:types
npm test -- <changed-spec-paths>
```

For broad changes, use the repository scripts in `package.json`. Run the relevant
Storybook, accessibility, or end-to-end checks for UI behavior changes. Do not claim a
check passed without observing its output.

## Completion Criteria

A task is complete only when the requested behavior is implemented, affected rules and
skills have been applied, sensitive-data constraints are preserved, and relevant checks
have run. Report any unrun check or unresolved failure explicitly.
