---
title: "Auto-imports skill"
description: "Use when working with the Stacks auto-import system."
---
# Auto-imports

`stacks-auto-imports` · Platform · model-invoked

What is available without an import, which differs between browser and server, and
the manifests and generated declarations that decide it. Worth reading before you
assume a name is global.

## When to reach for it

- Understanding how browser and server auto-imports work
- Configuring auto-imported functions/models/composables
- The auto-import manifests
- Type generation
- How globals are injected

## Covers

auto-import pipeline at storage/framework/auto-imports/.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- How Auto-Imports Work
- What Gets Auto-Imported
- Auto-Import Type Declarations
- Generation Commands
- Server Auto-Import Initialization
- Gotchas

## Where the code lives

- Auto-import functions: `storage/framework/auto-imports/functions.ts`
- Auto-import models: `storage/framework/auto-imports/models.ts`
- Auto-import index: `storage/framework/auto-imports/index.ts`
- Auto-import globals: `storage/framework/auto-imports/globals.ts`
- Global type declarations: `storage/framework/auto-imports/globals.d.ts`
- Browser manifest: `storage/framework/browser-auto-imports.json`
- Server manifest: `storage/framework/server-auto-imports.json`
- Browser type declarations: `storage/framework/types/browser-auto-imports.d.ts` (~80KB)
- Server type declarations: `storage/framework/types/server-auto-imports.d.ts`
- General auto-import types: `storage/framework/types/auto-imports.d.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-auto-imports
```

Source: [`stacks-auto-imports/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-auto-imports/SKILL.md).
Shadow it for one project with `app/Skills/stacks-auto-imports/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
