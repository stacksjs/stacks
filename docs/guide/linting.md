---
title: Linting and formatting
description: Enforce TypeScript, STX, Markdown, JSON, and configuration style with Pickier and Buddy.
---

# Linting and formatting

Stacks uses Pickier as its single linting and formatting entrypoint. The same commands run locally and in CI.

## Commands

```bash
buddy lint
buddy lint --fix
buddy lint:fix
buddy format
buddy format:check
```

Run Pickier directly when working on framework internals:

```bash
bunx --bun pickier .
bunx --bun pickier . --fix
```

## Covered files

Pickier checks TypeScript, JavaScript, STX templates, Markdown, JSON, YAML, TOML, and other project configuration. STX files use the same TypeScript and markup rules as the application build.

## Configuration

Application defaults live in `config/code-style.ts`. Standalone packages commonly expose `.config/pickier.ts`:

```ts
import type { PickierConfig } from 'pickier'

export default {
  rules: {
    'style/semi': ['error', 'never'],
    'style/quotes': ['error', 'single'],
  },
} satisfies PickierConfig
```

Use the smallest override necessary. Shared defaults come from `better-dx`, so do not install a second linter or formatter beside it.

## STX rules

STX templates must use `.stx` files and STX-compatible scripts:

```html
<script>
const count = ref(0)

function increment() {
  count.value++
}
</script>

<template>
  <button @click="increment">{{ count }}</button>
</template>
```

Direct DOM scripting and components from another UI runtime are not part of a Stacks application.

## CI

Use a frozen install, then run lint, types, tests, and build:

```bash
bun install --frozen-lockfile
buddy lint
buddy test:types
buddy test
buddy build
```

Warnings should be reviewed rather than silently ignored. Fix generated output at its source so regeneration does not reintroduce the same finding.

## Related commands

- [Buddy lint](/guide/buddy/lint)
- [Buddy test](/guide/buddy/test)
- [STX templates](/packages/stx)
