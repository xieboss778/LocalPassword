# LocalPass Agent Instructions

These instructions apply to every agent working in this repository. More specific
`AGENTS.md` files and direct user instructions take precedence.

## Project Identity

- Product name: **LocalPass**; repository: `LocalPassword`.
- This is an independent project. Some code has Bitwarden origins, but the official
  Bitwarden repository, plugins, marketplaces, issue trackers, and delivery workflows
  are not authoritative here.
- Fetch and pull only from `origin`: `https://github.com/xieboss778/LocalPass.git`.
  Do not add an `upstream` remote or merge, rebase onto, or cherry-pick official Bitwarden code.

## Required Workflow

1. Decompose the request first: identify every independent workstream and apply
   [Multi-Agent Parallel Work](#multi-agent-parallel-work-mandatory) before acting.
2. Inspect the target app or library and nearby code before editing.
3. Load every applicable skill with the `skill` tool before acting. Catalog summaries
   are routing hints, not skill instructions.
4. For UI work, load `ui-ux-pro-max`. For Angular implementation, also load
   `writing-client-code`; load `angular-modernization` only for migration work.
5. Make the smallest change that satisfies the request. Preserve unrelated user work.
6. Validate the changed surface and report the exact commands and observed results.

## Release Versioning

- Distributable Windows, macOS, and browser-extension builds use the same `YYYY.MM.N`
  version. Before each release build, increment `N` by exactly one from the previous
  released build; one release must use one version across all three clients.
- Update every version source before triggering CI: `apps/browser/package.json`,
  `apps/browser/src/manifest.json`, `apps/browser/src/manifest.v3.json`,
  `apps/desktop/package.json`, `apps/desktop/src/package.json`,
  `apps/desktop/src/package-lock.json`, and the workspace metadata in the root
  `package-lock.json`. Commit the version bump with the release changes.
- When the previous build number is unclear, inspect the latest successful GitHub
  Actions run and its artifacts before choosing the next version.
- Development, watch, and test-only builds that are not distributed do not increment
  the release version.

## Multi-Agent Parallel Work (Mandatory)

Split before you start. A task with two or more independent workstreams MUST run those
workstreams concurrently: launch one agent per workstream in a single message, then
integrate and verify the combined result yourself. Workstreams are independent when
neither needs the other's output and their file sets are disjoint.

- **Fan out, don't queue.** Separate areas to read, search, or analyze → one read-only
  agent per area, launched together. Separate modules to change → one agent per module.
- **Keep file ownership disjoint.** Each agent edits only its own files. Serialize any
  work that must touch the same file; never let two agents edit it concurrently.
- **Integrate in the dispatching agent.** Define each scope, wait for every result,
  reconcile findings, run the verification commands, and report each agent's outcome.
  A subagent does not declare the task complete.
- **Guardrails apply to subagents.** Pass only the context a workstream requires.

Run a single workstream directly, even if it takes several steps. If independent work
exists but the harness cannot launch agents, report that limitation rather than claiming
it ran in parallel.

## Security Guardrails

- Use synthetic examples for vault data, passwords, keys, tokens, and personal data.
- Keep sensitive values out of logs, errors, screenshots, search queries, persisted
  design files, commits, and external services.
- Add no new encryption logic. Escalate significant encryption or key-handling changes
  to the repository owner before implementation. Report suspected vulnerabilities privately
  per [SECURITY.md](SECURITY.md), not in public issues or PRs.
- Commit no secrets or credentials.

## Monorepo Boundaries

- `apps/<client>/` contains client-specific code.
- Code in `libs/common/` must work in background scripts and service workers without
  Angular: no Angular decorators, `inject()`, or template-only APIs.
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
| Desktop Flatpak manifest              | `.claude/rules/flatpak-manifest.md`                                      |

## Verification

For Markdown-only changes, run `npx prettier --check` on the changed Markdown files and
`git diff --check`. Verify changed links, rule globs, and workspace commands against the
repository. Type checks, Jest, and application builds are for code changes.

For localized code changes, scope linting and formatting to touched files:

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
