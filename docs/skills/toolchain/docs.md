---
title: "Docs skill"
description: "Use when building or configuring documentation for a Stacks project."
---
# Docs

`stacks-docs` · Toolchain · model-invoked

The documentation site: BunPress setup, generation, navigation and sidebar
structure, and the page metadata that feeds SEO.

## When to reach for it

- BunPress setup
- Doc generation
- Navigation
- Sidebar structure
- Documentation meta/SEO

## Covers

`@stacksjs/docs`, `config/docs.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- API
- Meta Exports
- Configuration (config/docs.ts)
- CLI Commands
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/docs/src/`
- Doc content: `docs/`
- Config: `config/docs.ts`
- Output: `storage/framework/docs/dist/`
- Package: `@stacksjs/docs`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-docs
```

Source: [`stacks-docs/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-docs/SKILL.md).
Shadow it for one project with `app/Skills/stacks-docs/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
