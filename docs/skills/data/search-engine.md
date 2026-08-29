---
title: "Search engine skill"
description: "Use when implementing search in Stacks."
---
# Search engine

`stacks-search-engine` · Data layer · model-invoked

Full-text search over Meilisearch or Algolia, and the `useSearch` trait that keeps
a model indexed without a line of glue code. Covers indexing, search settings and
driver configuration.

## When to reach for it

- Full-text search with Meilisearch
- Algolia backends
- Document indexing
- Search settings management
- The useSearch model trait for automatic indexing
- Search driver configuration

## Covers

`@stacksjs/search-engine`, `config/search-engine.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Search Driver Factory
- Document Operations
- Model Integration (useSearch Trait)
- CLI Commands
- Driver Comparison
- config/search-engine.ts
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/search-engine/src/`
- Configuration: `config/search-engine.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-search-engine
```

Source: [`stacks-search-engine/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-search-engine/SKILL.md).
Shadow it for one project with `app/Skills/stacks-search-engine/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
