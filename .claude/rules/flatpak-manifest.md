---
paths:
  - "apps/desktop/resources/com.localpass.desktop.devel.yaml"
---

# Flatpak Manifest

The desktop workspace uses this manifest for local runs (`flatpak:dev`) and bundle builds
(`pack:lin:flatpak`). If the manifest name or app ID changes, check both scripts in
[apps/desktop/package.json](../../apps/desktop/package.json).

For each new sandbox permission in `finish-args`, explain in the PR which desktop feature needs it.
