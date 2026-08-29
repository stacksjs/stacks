---
title: "Plugins skill"
description: "Use when working with the Stacks preload chain and Bun plugins."
---
# Plugins

`stacks-plugins` · Toolchain · model-invoked

The preload chain: the env plugin, the framework preloader, how auto-imports reach
`globalThis`, and why a given command does or does not see the framework globals.

## When to reach for it

- The env plugin
- The framework preloader
- How auto-imports get injected into globalThis
- Why a command does
- Does not see framework globals
- The bun-plugin-stx static-serve plugin
- Writing a Bun plugin

## Covers

bunfig.toml preload, `storage/framework/defaults/resources/plugins/preloader.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- The preload chain
- What the preloader does
- The fast-command skip (the usual gotcha)
- Writing a Bun plugin
- Gotchas

## Where the code lives

- Preload declaration: `bunfig.toml` (`preload`, at the root and under `[test]`)
- Env plugin: `storage/framework/core/env/plugin.ts`
- Framework preloader: `storage/framework/defaults/resources/plugins/preloader.ts`
- Static-serve plugin: `bunfig.toml`, `[serve.static] plugins = ["bun-plugin-stx"]`

## Related skills

- [Auto-imports](/skills/platform/auto-imports)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-plugins
```

Source: [`stacks-plugins/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-plugins/SKILL.md).
Shadow it for one project with `app/Skills/stacks-plugins/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
