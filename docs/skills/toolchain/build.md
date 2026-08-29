---
title: "Build skill"
description: "Use when working with the Stacks build system."
---
# Build

`stacks-build` · Toolchain · model-invoked

Building component and function libraries, CLI binaries, server images, docs and
the framework core, plus the library packaging that publishes slices of
`resources/` to npm.

## When to reach for it

- Building component libraries
- CLI binaries
- Server Docker images
- Documentation
- The framework core

## Covers

`@stacksjs/build`, buddy build commands, build actions, the server build pipeline.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- Build Types
- CLI Commands
- Standard Build Pattern
- Releasing libraries out of `resources/`
- Build Utilities (index.ts)
- Server Build Pipeline (7 stages)
- Build Action Enums
- Build Tool Stack
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/build/`
- Build actions: `storage/framework/core/actions/src/build/`
- Main build action: `storage/framework/core/actions/src/build.ts`
- Buddy commands: `storage/framework/core/buddy/src/commands/build.ts`
- Server build: `storage/framework/server/build.ts`
- Server Dockerfile: `storage/framework/server/Dockerfile`
- Types: `storage/framework/core/types/src/cli.ts`

## Related skills

- [Server](/skills/toolchain/server)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-build
```

Source: [`stacks-build/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-build/SKILL.md).
Shadow it for one project with `app/Skills/stacks-build/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
