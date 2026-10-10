---
title: "Search engine skill"
description: "Use when implementing search in Stacks - full-text search with Meilisearch or Algolia backends, document indexing, search settings management, the useSearch model trait for automatic indexing, or search driver configuration. Covers @stacksjs/search-engine and config/search-engine.ts."
---
# Search engine

`stacks-search-engine` · Native Stacks · model-invoked

Use when implementing search in Stacks - full-text search with Meilisearch or Algolia backends, document indexing, search settings management, the useSearch model trait for automatic indexing, or search driver configuration. Covers @stacksjs/search-engine and config/search-engine.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Search Driver Factory
- Document Operations
- Model Integration (useSearch Trait)
- CLI Commands
- Driver Comparison
- config/search-engine.ts
- Gotchas
- Readiness and driver boundaries

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-search-engine
```

Source: [`stacks-search-engine/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-search-engine/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-search-engine/SKILL.md`. See [Using skills](/skills/using).
