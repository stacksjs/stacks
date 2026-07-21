---
title: StackBlitz
description: Stacks provides a browser-native stx starter for quick frontend experiments and reproducible examples.
---
# StackBlitz

Stacks provides a browser-native stx starter for quick frontend experiments and reproducible examples.

[Open the Stacks starter in StackBlitz](https://stackblitz.com/fork/github/stacksjs/stackblitz?title=Stacks%20Starter)

The dedicated [stacksjs/stackblitz](https://github.com/stacksjs/stackblitz) starter installs, compiles, serves, and tests the preview with Bun. It reloads automatically when a view or stylesheet changes.

## Supported in StackBlitz

- stx templates and expressions
- HTML and CSS changes
- frontend component experiments
- shareable bug reproductions
- live preview and reload

## Full projects still run locally

The browser starter is intentionally frontend-scoped. Full Stacks projects also use SQLite, rpx, and tlsx, so database, backend, cloud, and pretty local domain development run locally:

```bash
panx @stacksjs/buddy new my-app
cd my-app
./buddy dev
```

The local command keeps pretty HTTPS URLs as the default through rpx and tlsx.
