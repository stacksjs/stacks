---
title: "Path skill"
description: "Use when working with file paths in Stacks."
---
# Path

`stacks-path` · Platform · model-invoked

The 100+ framework-aware path builders, one per directory in the project, plus
the standard path utilities.

## When to reach for it

- 100+ framework-aware path builder functions for every directory in the project (actions, app, config, database, models, routes, storage, etc.)
- Plus Node.js path utilities (join, resolve, basename, dirname, etc.)

## Covers

`@stacksjs/path`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Path
- Node.js Path Re-exports
- Framework Path Builders
- Path with Suffix
- Gotchas

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-path
```

Source: [`stacks-path/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-path/SKILL.md).
Shadow it for one project with `app/Skills/stacks-path/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
