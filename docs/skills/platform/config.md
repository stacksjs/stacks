---
title: "Config skill"
description: "Use when working with Stacks configuration."
---
# Config

`stacks-config` · Platform · model-invoked

The ~44 typed config files, the `defineX()` builder functions behind them, the
defaults, and how environment-specific overrides resolve.

## When to reach for it

- The 44 config files
- Config helper functions
- Default values
- Environment-specific overrides
- The defineApp/defineDatabase/etc builder functions

## Covers

`@stacksjs/config`, config/ directory.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Config API
- Individual Config Exports
- Config Builder Functions
- Helper Functions
- All 44 Config Files
- Default Values (from defaults.ts)
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/config/src/`
- Configuration directory: `config/`
- Defaults: `storage/framework/core/config/src/defaults.ts`
- Overrides: `storage/framework/core/config/src/overrides.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-config
```

Source: [`stacks-config/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-config/SKILL.md).
Shadow it for one project with `app/Skills/stacks-config/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
