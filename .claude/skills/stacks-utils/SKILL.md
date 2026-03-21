---
name: stacks-utils
description: Use when needing general utility functions in a Stacks application — the umbrella utilities package that re-exports arrays, objects, strings, and other helper packages. Covers @stacksjs/utils.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Utilities

The `@stacksjs/utils` package provides general-purpose helper functions, aggregating utilities from specialized packages.

## Key Paths
- Core package: `storage/framework/core/utils/src/`
- Package: `@stacksjs/utils`

## Re-exports
Utils aggregates utilities from:
- `@stacksjs/arrays` - Array utilities
- `@stacksjs/objects` - Object utilities
- `@stacksjs/strings` - String utilities
- Additional general-purpose helpers

## Usage
```typescript
import { isString, isEmpty, deepMerge } from '@stacksjs/utils'
```

## Gotchas
- Utils is the umbrella package — for specific utilities, use the dedicated package
- Many packages depend on utils as a convenience import
- Prefer specific imports (`@stacksjs/strings`) over general (`@stacksjs/utils`) when possible for tree-shaking
