---
name: opencode
description: Configure and troubleshoot OpenCode V2 in LocalPass. Use for OpenCode configuration, project skills, agents, commands, plugins, MCP, permissions, providers, CLI settings, service/API/SDK, or V1 migration questions.
---

# OpenCode in LocalPass

Project-level guidance for OpenCode V2. This file lives at
`.claude/skills/opencode/SKILL.md`; OpenCode discovers `.claude/skills/` as a
project compatibility source, so no `opencode.json` registration is required.
The path-derived skill ID is `opencode`.

## Source of truth

- Default to OpenCode V2. Use only <https://opencode.ai/v2/docs/> and its linked
  pages as the documentation source. Start at <https://opencode.ai/v2/llms.txt>
  when the relevant page is not listed below.
- Fetch the full guide for the affected feature before answering or editing. Do
  not guess field names or configuration shapes.
- Keep the published `$schema` URL in JSON/JSONC examples, but verify fields
  against the V2 guides rather than inferring them from the schema document.
- Consult V1 documentation only for an explicit V1 question or migration. Read
  the complete [migration guide](https://opencode.ai/v2/docs/migrate-v1) before
  converting anything; supported V1 configuration is intended to remain
  compatible, and conversion is optional.
- LocalPass repository rules and existing project configuration take precedence
  over generic examples. LocalPass is independent; official Bitwarden
  repositories, plugins, marketplaces, and delivery workflows are not
  authoritative here.

## Workflow

1. Run `git status --short` and inspect existing files before editing. Preserve
   unrelated user work.
2. Inspect `opencode.json`, `opencode.jsonc`, `.opencode/opencode.json`,
   `.opencode/opencode.jsonc`, and the relevant `.opencode/` or `.claude/skills/`
   directories. Check nested package configuration when the request targets a
   monorepo package.
3. Identify the affected surface: project/server configuration, global CLI
   preferences, a file-based definition, or a runtime integration.
4. Read the matching V2 guide below, including any linked detail page needed for
   the exact change.
5. Make the smallest change that satisfies the request. Preserve unrelated
   settings and existing definition IDs.
6. Validate the changed surface with the commands in **Validation**. Report the
   exact commands and observed results, including any unrun check.

## Configuration and discovery

- Project configuration may live in `opencode.json(c)` or
  `.opencode/opencode.json(c)`. OpenCode merges discovered files from ancestors
  through the current directory; `.opencode/` configuration takes precedence
  over direct configuration.
- Global configuration lives at `~/.config/opencode/opencode.json(c)`.
- CLI/TUI preferences are separate and global only:
  `~/.config/opencode/cli.json`, or `$XDG_CONFIG_HOME/opencode/cli.json` when
  `XDG_CONFIG_HOME` is set. There is no project-local CLI configuration.
- Native project skills live in `.opencode/skills/`. Compatibility sources
  include `.claude/skills/` and `.agents/skills/`. Explicit `skills` entries in
  OpenCode configuration have higher precedence.
- Skills are selected by path-derived, case-sensitive ID. Prefer a lowercase
  kebab-case directory name matching the ID, such as
  `.opencode/skills/git-release/SKILL.md`.
- A skill directory contains exactly one `SKILL.md`; supporting scripts,
  references, and templates sit beside it. Paths inside the skill are relative
  to that directory.
- Add a clear `description` for model discovery. Use
  `metadata.opencode/autoinvoke: false` or `disable-model-invocation: true` only
  when the skill should be loaded explicitly rather than advertised.
- Avoid duplicate IDs unless intentionally overriding a lower-precedence skill.
  A native `.opencode/skills/opencode/SKILL.md` would override this compatibility
  copy.

## Feature guides

| Surface                      | V2 guide                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| Configuration and precedence | <https://opencode.ai/v2/docs/config>                                                |
| Skills and discovery         | <https://opencode.ai/v2/docs/skills>                                                |
| Agents                       | <https://opencode.ai/v2/docs/agents>                                                |
| Commands                     | <https://opencode.ai/v2/docs/commands>                                              |
| Instructions                 | <https://opencode.ai/v2/docs/instructions>                                          |
| Permissions and policies     | <https://opencode.ai/v2/docs/permissions>, <https://opencode.ai/v2/docs/policies>   |
| MCP servers                  | <https://opencode.ai/v2/docs/mcp-servers>                                           |
| Plugins                      | <https://opencode.ai/v2/docs/plugins>, <https://opencode.ai/v2/docs/build/plugins>  |
| Providers and models         | <https://opencode.ai/v2/docs/providers>, <https://opencode.ai/v2/docs/models>       |
| CLI and terminal settings    | <https://opencode.ai/v2/docs/cli>, <https://opencode.ai/v2/docs/cli/config>         |
| Service troubleshooting      | <https://opencode.ai/v2/docs/troubleshooting>                                       |
| Server API                   | <https://opencode.ai/v2/docs/api>                                                   |
| SDK and client integrations  | <https://opencode.ai/v2/docs/build/sdk>, <https://opencode.ai/v2/docs/build/client> |

## Security and runtime guardrails

- Keep credentials out of committed configuration. Use `{env:VARIABLE_NAME}` or
  `{file:path/to/secret}` substitution where appropriate.
- Prefer OAuth for remote MCP servers. If authentication is required, direct the
  user to `/mcps` to sign in; do not run the interactive `opencode mcp auth` flow
  through the shell tool.
- Use synthetic examples for vault data, passwords, keys, tokens, and personal
  data. Keep sensitive values out of prompts, logs, screenshots, persisted
  artifacts, commits, and external services.
- Redact configuration output before sharing diagnostics. Do not delete or edit
  OpenCode's database, service registration, or service configuration while
  troubleshooting.

## Validation

- Confirm the installed version with `opencode --version`.
- After configuration edits, run `opencode debug config` to confirm the loaded
  sources and `opencode reload` to refresh the running service. Redact sensitive
  output before reporting it.
- After agent-definition edits, run `opencode debug agents`.
- For service issues, run `opencode service status` and
  `opencode api get /api/info`; restart only when needed with
  `opencode service restart`.
- After skill edits, confirm the exact path-derived ID, frontmatter, description,
  and precedence. Load it explicitly with the `skill` tool or `@opencode` to
  verify the intended content is selected.
- Format touched JSON/JSONC/Markdown files with the repository's Prettier setup.
  Code-only type checks and Jest suites are not applicable to a skill-only
  change.
