---
title: "Alias skill"
description: "Use when working with path aliases in a Stacks project."
---
# Alias

`stacks-alias` · Platform · model-invoked

The 260+ path mappings that let `@stacksjs/*` resolve across the framework, and
what to check when an import will not resolve.

## When to reach for it

- Import resolution
- Module aliasing
- Debugging import paths

## Covers

@stacksjs/alias which defines 260+ path mappings for the entire framework.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- API
- Alias Categories
- Usage
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/alias/src/`
- Source: `storage/framework/core/alias/src/index.ts`
- Package: `@stacksjs/alias`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-alias
```

Source: [`stacks-alias/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-alias/SKILL.md).
Shadow it for one project with `app/Skills/stacks-alias/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
