# Project-local skills

## Matt Pocock skills

The `engineering/*` and `productivity/*` skill directories in this folder are
copied from [mattpocock/skills](https://github.com/mattpocock/skills) at commit
`abeeaf95660ba9e8b7c753eb38f441ca707a8823` (plugin version `1.3.2`).

Only the 27 skills listed in the upstream `.claude-plugin/plugin.json` are
included. The upstream `in-progress/`, `misc/`, and `deprecated/` buckets were
deliberately excluded.

To update, replace these directories with files from a newer upstream checkout;
they are editable local copies, not a managed plugin.

## UI/UX Pro Max

`ui-ux-pro-max/` is a project-local copy of the core
[UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) skill,
version `2.15.0`, sourced from `/Users/bossxie/dev/Temp/ui-ux-pro-max-skill-main`.
Its catalogs, search scripts, and references are vendored so the skill works
without the source checkout or network access. Upstream repository-development
tests are omitted from the installed copy; the source suite passes independently.

The LocalPass integration section in both copies records the Angular, Tailwind,
component, and sensitive-data constraints. The six optional sibling skills are
intentionally not installed; the core skill covers this repository's UI/UX work.

OpenCode CLI uses the dedicated, higher-precedence copy at
`.opencode/skills/ui-ux-pro-max/`. It intentionally shares the `ui-ux-pro-max` ID
and overrides the `.claude/skills/` compatibility copy. The OpenCode `SKILL.md`
uses commands relative to its own base directory; the Claude copy uses
project-rooted commands.

To update, replace both directories from the upstream core skill, preserve the
LocalPass integration section, and restore each layout's script-path convention.
The upstream MIT license is retained in both `LICENSE` files.

## Matt Pocock upstream license

MIT License

Copyright (c) 2026 Matt Pocock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
