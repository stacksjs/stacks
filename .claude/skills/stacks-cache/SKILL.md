---
name: stacks-cache
description: Use when implementing caching in a Stacks application — configuring cache drivers, cache invalidation, or using the caching API. Covers the @stacksjs/cache package and config/cache.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Cache

The `@stacksjs/cache` package provides a caching framework for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/cache/src/`
- Configuration: `config/cache.ts`
- Cache storage: `storage/framework/cache/`
- Package: `@stacksjs/cache`

## Configuration
Edit `config/cache.ts` to configure cache drivers, TTL defaults, and cache stores.

## Usage
```typescript
import { cache } from '@stacksjs/cache'
```

## Features
- Multiple cache driver support
- Configurable TTL (time-to-live)
- Cache tags and invalidation
- Framework-level caching for auto-imports and discovered packages

## Framework Cache Files
- `storage/framework/cache/` - Framework-level cache directory
- `storage/framework/discovered-packages.json` - Cached package discovery

## Gotchas
- Cache directory is excluded from the workspace definition
- Framework caches may need clearing after package changes
- Use `buddy clean` or `buddy fresh` to clear framework caches
- Cache invalidation should be handled explicitly in application code
