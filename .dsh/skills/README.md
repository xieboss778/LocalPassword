# DeepSeek Harness skills

This directory is discovered by DeepSeek Harness as project-level skills. Each
`<name>/SKILL.md` must have a kebab-case `name`, a non-empty `description`, and valid
boolean invocation flags. Descriptions are capped at 500 characters in the model
catalog.

## Sources

- Engineering and productivity skills are local copies of
  [mattpocock/skills](https://github.com/mattpocock/skills), plugin version `1.3.2`.
- `ui-ux-pro-max` is the LocalPass-adapted core skill from
  [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), version
  `2.15.0`, with local catalogs and scripts.
- Additional DSH-specific invocation policy is documented in `../README.md`.

## LocalPass policy

Repository-root `AGENTS.md` overrides inherited Bitwarden-specific wording, paths,
and workflows. Skills that assume the official Bitwarden monorepo are hidden until
rewritten for this independent project.

The Matt Pocock upstream MIT license follows.

## Upstream license

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
