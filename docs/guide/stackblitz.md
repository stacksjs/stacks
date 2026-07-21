---
title: StackBlitz
description: Stacks provides a browser-native stx starter for quick frontend experiments and reproducible examples.
---
# StackBlitz

Stacks provides a browser-native stx starter for quick frontend experiments and reproducible examples.

[Open the Stacks starter in StackBlitz](https://stackblitz.com/fork/github/stacksjs/stacks/tree/main/examples/stackblitz?startScript=dev&title=Stacks%20Starter)

The starter compiles `.stx` files with `@stacksjs/stx`, serves the result from a zero-dependency Node.js server, and reloads the preview when a view or stylesheet changes.

## Supported in StackBlitz

- stx templates and expressions
- HTML and CSS changes
- frontend component experiments
- shareable bug reproductions
- live preview and reload

## Local development remains the full runtime

StackBlitz WebContainers provide Node.js, not Bun. Full Stacks projects also use SQLite, rpx, and tlsx, so database, backend, cloud, and pretty local domain development run locally:

```bash
panx @stacksjs/buddy new my-app
cd my-app
./buddy dev
```

The local command keeps pretty HTTPS URLs as the default through rpx and tlsx.
