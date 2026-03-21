---
name: stacks-strings
description: Use when working with string manipulation utilities in Stacks — formatting, case conversion, pluralization, or string transformations. Covers the @stacksjs/strings package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks String Utilities

The `@stacksjs/strings` package provides string manipulation helpers for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/strings/src/`
- Package: `@stacksjs/strings`

## Features
- Case conversion (camelCase, PascalCase, snake_case, kebab-case)
- Pluralization and singularization
- String truncation and padding
- Template string helpers
- Slug generation helpers

## Usage
```typescript
import { camelCase, pascalCase, plural, singular } from '@stacksjs/strings'
```

## Gotchas
- For URL slugs specifically, use `@stacksjs/slug`
- String utilities are re-exported through `@stacksjs/utils`
- Pluralization rules may need customization for non-English locales
