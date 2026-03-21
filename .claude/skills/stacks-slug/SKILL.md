---
name: stacks-slug
description: Use when generating URL slugs in a Stacks application — creating URL-friendly strings from titles, names, or other text. Covers the @stacksjs/slug package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Slug

The `@stacksjs/slug` package provides slug generation for URL-friendly strings.

## Key Paths
- Core package: `storage/framework/core/slug/src/`
- Package: `@stacksjs/slug`

## Features
- URL-friendly string generation
- Unicode support
- Custom separator configuration
- Transliteration

## Usage
```typescript
import { slug } from '@stacksjs/slug'

slug('Hello World') // 'hello-world'
```

## Gotchas
- Slugs are used extensively in CMS, blog, and commerce features
- Handles unicode characters via transliteration
- Used by models for URL generation
