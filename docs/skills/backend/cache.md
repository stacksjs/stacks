---
title: "Cache skill"
description: "Use when implementing caching in Stacks - memory cache, Redis cache, cache-aside pattern (getOrSet), TTL management, cache stats, or cache configuration. Covers @stacksjs/cache and config/cache.ts."
---
# Cache

`stacks-cache` · Native Stacks · model-invoked

Use when implementing caching in Stacks - memory cache, Redis cache, cache-aside pattern (getOrSet), TTL management, cache stats, or cache configuration. Covers @stacksjs/cache and config/cache.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- API and TTL
- Cache-aside and concurrent misses
- Drivers
- Tag invalidation and advanced patterns
- Source and verification

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-cache
```

Source: [`stacks-cache/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-cache/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-cache/SKILL.md`. See [Using skills](/skills/using).
