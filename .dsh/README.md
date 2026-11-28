# DeepSeek Harness project configuration

This directory is checked into Git so the project instructions and reusable
skills can be shared. It configures DeepSeek Harness (DSH) without changing
product code. Do not store credentials, machine-specific settings, or runtime
state here.

## What DSH loads

- Project instructions: repository-root `AGENTS.md`.
- Skills: `.dsh/skills/<name>/SKILL.md` and flat `.dsh/skills/<name>.md` files.
- Skill resources: files beside each `SKILL.md`, loaded on demand.

DSH does **not** automatically load `.claude/` project configuration; active
instructions live in repository-root `AGENTS.md` and `.claude/rules/`.

## Skill policy for Hermes

The model-invoked catalog is limited to skills useful in this repository. Low-frequency
setup and writing workflows remain available only through explicit `/name` invocation.
The following upstream-only or incompatible skills are hidden from both model and user
invocation until they are rewritten for LocalPass:

- `cipher-type-planner`
- `create-hec-event-integration`
- `create-pull-request`
- `evaluating-sdk-internal-updates`
- `git-guardrails-claude-code`

These remain user-invocable only:

- `migrate-to-shoehorn`
- `scaffold-exercises`
- `setup-pre-commit`
- `wizard`

`ui-ux-pro-max` is the LocalPass-adapted copy of the same skill used by Claude and
OpenCode. Its commands are relative to `.dsh/skills/ui-ux-pro-max`.

## Validation

From the repository root:

```bash
node .dsh/scripts/validate-skills.mjs
```

The validator checks DSH's kebab-case names, required descriptions, 500-character
catalog limit, boolean invocation flags, duplicate IDs, and local resource pointers.

## Updating

- Keep repository-root `AGENTS.md` as the authoritative project instruction file.
- Sync reusable skills from `.claude/skills/`, then reapply the DSH invocation policy.
- Preserve skill-relative paths such as `scripts/search.py` and `references/...`.
- Do not restore Claude marketplace settings or hooks unless DSH is explicitly
  configured with a compatible bridge.
