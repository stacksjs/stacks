---
name: stacks-objects
description: Use when working with object manipulation utilities in Stacks — deep merging, cloning, picking, omitting, or transforming objects. Covers the @stacksjs/objects package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Object Utilities

The `@stacksjs/objects` package provides object manipulation helpers for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/objects/src/`
- Package: `@stacksjs/objects`

## Features
- Deep merge
- Object cloning
- Pick and omit properties
- Object comparison
- Type-safe object transformations

## Usage
```typescript
import { deepMerge, pick, omit } from '@stacksjs/objects'
```

## Gotchas
- For complex data structures, consider `@stacksjs/collections`
- Object utilities are re-exported through `@stacksjs/utils`
- Prefer immutable patterns -- deep clone before mutating
