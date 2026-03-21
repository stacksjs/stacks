---
name: stacks-collections
description: Use when working with collection data structures in Stacks — chaining array operations, mapping, filtering, reducing, or using Laravel-style collection methods. Covers the @stacksjs/collections package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Collections

The `@stacksjs/collections` package provides Laravel-style collection utilities for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/collections/src/`
- Package: `@stacksjs/collections`

## Features
- Fluent, chainable collection API
- map, filter, reduce, groupBy, sortBy operations
- Type-safe collection transformations
- Laravel-inspired collection methods

## Usage
```typescript
import { collect } from '@stacksjs/collections'

const result = collect([1, 2, 3, 4, 5])
  .filter(n => n > 2)
  .map(n => n * 2)
  .toArray()
```

## Gotchas
- For simple array operations, `@stacksjs/arrays` may suffice
- Collections provide a fluent API on top of basic array utilities
- Collections are immutable — operations return new collection instances
