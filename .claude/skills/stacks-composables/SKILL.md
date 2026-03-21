---
name: stacks-composables
description: Use when creating or using reactive composables in STX templates — signals, reactive state, computed values, or shared composable logic. Covers the @stacksjs/composables package for STX-reactive composables.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Composables

The `@stacksjs/composables` package provides STX-reactive composables for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/composables/src/`
- Package: `@stacksjs/composables`

## Purpose
- Provides reactive primitives for STX templates
- Enables shared state management between components
- Supports signals, computed values, and watchers
- STX-compatible reactive patterns

## Usage in STX Templates
STX `<script>` tags should only contain stx-compatible code:
- Signals
- Composables
- Directives

```html
<script>
// Only stx-compatible code here
import { useCounter } from '@stacksjs/composables'
const { count, increment } = useCounter()
</script>
```

## Gotchas
- NEVER write vanilla JS (`var`, `document.*`, `window.*`) in STX templates
- Composables must be STX-compatible
- Use `@stacksjs/browser` for browser-specific utilities
- Composables are auto-imported in STX templates
- See `storage/framework/browser-auto-imports.json` for available auto-imports
