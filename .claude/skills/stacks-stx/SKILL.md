---
name: stacks-stx
description: Use when working with STX templates in a Stacks application — writing STX template syntax, creating components, using directives, signals, or debugging STX rendering issues. STX is the ONLY templating system for Stacks.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# STX Templating Engine

STX is the templating engine for Stacks applications. It provides a reactive, component-based templating system.

## Key Paths
- STX configuration: `config/stx.ts`
- STX plugin: `bun-plugin-stx` (loaded via bunfig.toml)
- STX directory: `.stx/`
- External tool: ~/Code/Tools/stx/
- Resources: `resources/`

## CRITICAL Rules
1. **ALWAYS use STX** for templating — never write vanilla JS
2. **NEVER use** `var`, `document.*`, `window.*` in STX templates
3. STX `<script>` tags should ONLY contain stx-compatible code:
   - Signals
   - Composables
   - Directives

## STX Template Structure
```html
<template>
  <!-- STX template markup with directives -->
</template>

<script>
// ONLY stx-compatible code: signals, composables, directives
import { ref, computed } from '@stacksjs/composables'
</script>

<style>
/* Use crosswind utility classes */
</style>
```

## Features
- Reactive signals and computed values
- Component composition
- Directive system
- Auto-imports for browser context
- Hot module replacement in development

## Plugin Loading
Configured in `bunfig.toml`:
```toml
[serve]
plugins = ["bun-plugin-stx"]
```

## Gotchas
- STX is processed by `bun-plugin-stx` which must be loaded as a serve plugin
- Auto-imports are defined in `storage/framework/browser-auto-imports.json`
- STX components go in `resources/` or `storage/framework/defaults/components/`
- The `.stx/` directory contains STX-specific configuration
- Use `@stacksjs/composables` for reactive primitives in STX templates
