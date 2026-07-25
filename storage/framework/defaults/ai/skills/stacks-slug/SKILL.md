---
name: stacks-slug
description: Use when generating URL slugs in Stacks — creating unique slugs with database collision detection, the uniqueSlug function with table/column configuration, or basic slugification. Covers @stacksjs/slug.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Slug

URL-friendly slug generation with database uniqueness checking.

## Key Paths
- Core package: `storage/framework/core/slug/src/`

## Unique Slug (with Database Check)

```typescript
import { uniqueSlug } from '@stacksjs/slug'

// Basic usage — checks 'slug' column in inferred table
const slug = await uniqueSlug('My Blog Post Title')
// → 'my-blog-post-title'

// If 'my-blog-post-title' exists in DB:
// → 'my-blog-post-title-2'

// With options
const slug = await uniqueSlug('Product Name', {
  table: 'products',     // database table to check
  column: 'slug'         // column name (default: 'slug')
})
```

### How Collision Detection Works
1. Slugifies the input string
2. Queries the database for existing slug
3. If collision found, appends `-2`, `-3`, etc.
4. Returns the first available slug

## Basic Slugify (No Database Check)

```typescript
import { slugify } from '@stacksjs/slug'

slugify('Hello World!')           // 'hello-world'
slugify('Ünïcödé Têxt')          // 'unicode-text'
slugify('  Extra   Spaces  ')    // 'extra-spaces'
```

Re-exported from `ts-slug` — handles Unicode transliteration.

## Model Usage

Models typically use slugs via the `slug` attribute:

```typescript
defineModel({
  name: 'Post',
  attributes: {
    title: { validation: { rule: schema.string() } },
    slug: {
      unique: true,
      validation: { rule: schema.string() },
      // Auto-generated from title via uniqueSlug()
    }
  }
})
```

## SlugifyOptions

```typescript
interface SlugifyOptions {
  table?: string         // database table for uniqueness check
  column?: string        // column name (default: 'slug')
}
```

## Gotchas
- `uniqueSlug()` is async — it queries the database
- `slugify()` is sync — no database interaction
- Collision detection appends `-2`, `-3`, etc. (not random suffixes)
- Unicode characters are transliterated (u → u, e → e, etc.)
- For string-only slugification without DB, use `slug()` from `@stacksjs/strings` instead
- Tags and Categories both use unique slugs by default
- Slug columns should have a unique index in the database
