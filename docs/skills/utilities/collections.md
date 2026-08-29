---
title: "Collections skill"
description: "Use when working with collection data structures in Stacks."
---
# Collections

`stacks-collections` · Utilities · model-invoked

Laravel-style chainable collections over arrays: map, filter, reduce and group,
wrapping `ts-collect`.

## When to reach for it

- Chaining array operations
- Laravel-style collection methods
- Mapping
- Filtering
- Reducing
- Grouping

## Covers

@stacksjs/collections which wraps ts-collect.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- API
- Usage
- Laravel-Style Methods
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/collections/src/`
- Source: `storage/framework/core/collections/src/index.ts`
- Package: `@stacksjs/collections`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-collections
```

Source: [`stacks-collections/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-collections/SKILL.md).
Shadow it for one project with `app/Skills/stacks-collections/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
