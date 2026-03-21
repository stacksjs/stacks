---
name: stacks-arrays
description: Use when working with array manipulation utilities in Stacks — sorting, filtering, grouping, chunking, or transforming arrays. Covers the @stacksjs/arrays helper package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Array Utilities

The `@stacksjs/arrays` package provides array manipulation helpers for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/arrays/src/`
- Package: `@stacksjs/arrays`

## Usage
```typescript
import { chunk, groupBy, unique, flatten } from '@stacksjs/arrays'
```

## Features
- Array chunking, flattening, and grouping
- Unique value extraction
- Type-safe array transformations
- Collection-like utilities for arrays

## Gotchas
- For more complex collection operations, use `@stacksjs/collections`
- Array utilities are re-exported through `@stacksjs/utils`
- Prefer these utilities over manual array operations for consistency
