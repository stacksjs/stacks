---
name: stacks-enums
description: Use when working with enum types and helpers in a Stacks application — defining enums, enum utilities, or type-safe enum patterns. Covers the @stacksjs/enums package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Enums

The `@stacksjs/enums` package provides enum helpers for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/enums/src/`
- Package: `@stacksjs/enums`

## Features
- Enum utility functions
- Type-safe enum patterns
- Enum value validation
- Enum serialization helpers

## Usage
```typescript
import { createEnum } from '@stacksjs/enums'
```

## Gotchas
- TypeScript enums can be tricky — prefer const enums or string unions where possible
- Enum helpers provide runtime validation on top of TypeScript's compile-time checks
- Used across the framework for consistent enum handling
