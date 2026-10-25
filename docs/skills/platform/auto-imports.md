---
title: "Auto-imports skill"
description: "Use when checking browser/server binding delivery, model globals, registry generation, or the difference between ambient declarations and runtime imports. Covers Stacks auto-imports, stx client delivery, server boot and generated registries (107 models)."
---
# Auto-imports

`stacks-auto-imports` · Platform · model-invoked

Use runtime-provided names directly in their execution context. The generated
`storage/framework/auto-imports/RUNTIME.md` lists this app's server helpers by
package and barrel, plus the installed STX runtime bindings, macros and demand
helpers. Read the relevant section before adding imports.

`buddy generate`, `buddy generate:types`, `buddy generate:auto-imports` and
`buddy setup:ai` refresh the reference from runtime registries. The bundled
skills point to this project file, so copied skills stay current after generation.
Standalone modules and scripts without Stacks boot still use explicit imports.

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

- Available names in this project
- Browser delivery paths
- Server boot and globals
- Generation and project overrides
- Verification and gotchas

## Where the code lives

- Auto-import functions: `storage/framework/auto-imports/functions.ts`
- Auto-import models: `storage/framework/auto-imports/models.ts`
- Auto-import index: `storage/framework/auto-imports/index.ts`
- Auto-import globals: `storage/framework/auto-imports/globals.ts`
- Generated AI reference: `storage/framework/auto-imports/RUNTIME.md`
- Browser manifest: `storage/framework/browser-auto-imports.json`
- Server manifest: `storage/framework/server-auto-imports.json`
- Browser type declarations: `storage/framework/types/browser-auto-imports.d.ts` (legacy declarations are pruned; STX supplies its own types)
- Server type declarations: `storage/framework/types/server-auto-imports.d.ts`
- Server primitive registry: `storage/framework/core/server/src/primitive-imports.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-auto-imports
```

Source: [`stacks-auto-imports/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-auto-imports/SKILL.md).
Shadow it for one project with `app/Skills/stacks-auto-imports/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).

## Native source verification

The skill has been checked against current source and retained tests. Read its
entrypoint and linked references for the actual contract; summaries here are
discovery pointers. [Native capabilities](/skills/platform/native) maps every
core package and records driver evidence without claiming universal parity.
