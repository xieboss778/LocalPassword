# LocalPass - Claude Code Configuration

## Project Context Files

Before a review, read the [project overview](../README.md) and [contributing guidelines](../CONTRIBUTING.md). Use the repository's PR checklist:

@../.github/PULL_REQUEST_TEMPLATE.md

## Critical Rules

- **CRITICAL**: This project (`LocalPass`) is independent and has **no relationship** with the official Bitwarden repository (`bitwarden/clients`, https://github.com/bitwarden/clients).
  - **NEVER** add an `upstream` remote, and **NEVER** fetch, merge, rebase, or cherry-pick official Bitwarden code.
  - **NEVER** suggest syncing, aligning, or updating this project from the official repository.
  - All `git pull` / `git fetch` operations must target `origin` only (`https://github.com/xieboss778/LocalPass.git`).
- **NEVER** use code regions: If complexity suggests regions, refactor for better readability
- **CRITICAL**: new encryption logic should not be added to this repo.
  - Discuss significant changes to existing encryption or key handling with the maintainer before implementation. For non-sensitive design changes, use a project issue and summarize the change in the PR (see [CONTRIBUTING.md](../CONTRIBUTING.md)). Report suspected vulnerabilities privately per [SECURITY.md](../SECURITY.md), never in a public issue or PR.
- **NEVER** send unencrypted vault data to API services
- **NEVER** commit secrets, credentials, or sensitive information.
- **NEVER** log decrypted data, encryption keys, or PII
  - No vault data in error messages or console logs
- **ALWAYS** Respect configuration files at the root and within each app/library (e.g., `eslint.config.mjs`, `jest.config.js`, `tsconfig.json`).
- **Mandatory parallel work:** when a request has two or more independent workstreams, launch their agents together in one message. Follow [AGENTS.md → Multi-Agent Parallel Work](../AGENTS.md#multi-agent-parallel-work-mandatory) for file ownership, integration, and verification.
- **Release versioning:** Every distributable build increments the release build number by exactly one and uses the same version across Windows, macOS, and the browser extension. Follow [AGENTS.md → Release Versioning](../AGENTS.md#release-versioning) before triggering CI.
- **CRITICAL**: Tailwind CSS classes MUST use the `tw-` prefix (e.g., `tw-flex`, `tw-p-4`). Missing prefix means the class is ignored and styling silently breaks. See [.claude/rules/tailwind.md](./rules/tailwind.md) for additional Tailwind rules.

## Mono-Repo Architecture

This repository is organized as a **monorepo** containing multiple applications and libraries. The
main directories are:

- `apps/<client>/` — single-client code (browser, desktop). Each app is self-contained.
- `libs/common/` — shared code that must work in background scripts, service workers, and other non-UI contexts. Keep it free of Angular decorators, `inject()`, and template APIs.
- `libs/angular/` — code shared across Angular clients (browser, desktop). Angular APIs allowed.
- Other `libs/*` (e.g. `ui`, `platform`, `key-management`, `vault`) — domain-scoped, follow the same Angular / non-Angular split based on which clients consume them.

When adding new code, place it as deep and as narrow as possible. Promote to a shared `libs/` only when a second client needs it.

**Strict boundaries** must be maintained between apps and libraries. Do not introduce
cross-dependencies that violate the intended modular structure. Always consult and respect the
dependency rules defined in `eslint.config.mjs`, `nx.json`, and other configuration files.

## Verifying Changes

For documentation-only changes, use the [Markdown checks](../AGENTS.md#verification). For code changes, run:

- `npm run lint:fix` — applies ESLint fixes
- `npm run prettier` — formats with Prettier
- `npm run test:types` — type-checks the workspace
- `npm test` — runs Jest. Scope with `npm test -- <path-or-pattern>` when changes are localized.
- For browser extension changes, run `npm run build:chrome --workspace @localpass/browser` from the repository root. For extension UI changes, load `apps/browser/build` and verify the changed behavior in the browser.

If any of these fail, fix the underlying issue before reporting the task complete. Do not skip hooks or bypass failures.

## References

These are upstream-origin reference materials. LocalPass documentation (in `docs/`, `README.md`, `CONTRIBUTING.md`, and `.claude/rules/`) takes precedence where they differ.

- [Web Clients Architecture](https://contributing.bitwarden.com/architecture/clients)
- [Architectural Decision Records (ADRs)](https://contributing.bitwarden.com/architecture/adr/)
- [Contributing Guide](https://contributing.bitwarden.com/)
- [Web Clients Setup Guide](https://contributing.bitwarden.com/getting-started/clients/)
- [Code Style](https://contributing.bitwarden.com/contributing/code-style/)
- [Security Whitepaper](https://bitwarden.com/help/bitwarden-security-white-paper/)
- [Security Definitions](https://contributing.bitwarden.com/architecture/security/definitions)
