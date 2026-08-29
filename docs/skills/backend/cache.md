---
title: "Cache skill"
description: "Use when implementing caching in Stacks - memory cache, Redis cache, cache-aside pattern (getOrSet), TTL management, cache stats, or cache configuration. Covers @stacksjs/cache and config/cache.ts."
---
# Cache

`stacks-cache` · Backend and API · model-invoked

Memory and Redis caching behind one interface, the cache-aside `getOrSet` pattern,
TTL management and cache statistics.

## When to reach for it

- Memory cache
- Redis cache
- Cache-aside pattern (getOrSet)
- TTL management
- Cache stats
- Cache configuration

## Covers

`@stacksjs/cache`, `config/cache.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Cache API (StacksCache)
- Factory Functions
- config/cache.ts
- Default Instance
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/cache/src/`
- Configuration: `config/cache.ts`
- Cache storage: `storage/framework/cache/`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-cache
```

Source: [`stacks-cache/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-cache/SKILL.md).
Shadow it for one project with `app/Skills/stacks-cache/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
