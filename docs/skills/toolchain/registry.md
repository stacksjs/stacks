---
title: "Registry skill"
description: "Use when working with the Stacks extension registry - framework extension metadata, package discovery, or the registry system. Covers @stacksjs/registry."
---
# Registry

`stacks-registry` · Toolchain · model-invoked

The extension registry: framework extension metadata and package discovery.

## When to reach for it

- Framework extension metadata
- Package discovery
- The registry system

## Covers

`@stacksjs/registry`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- API
- Usage
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/registry/src/`
- Config: `config/stacks.ts`
- Package: `@stacksjs/registry`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-registry
```

Source: [`stacks-registry/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-registry/SKILL.md).
Shadow it for one project with `app/Skills/stacks-registry/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
