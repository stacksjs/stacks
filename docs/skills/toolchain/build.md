---
title: "Build skill"
description: "Use when working with the Stacks build system - building component libraries, CLI binaries, server Docker images, documentation, or the framework core. Covers @stacksjs/build, buddy build commands, build actions, and the server build pipeline."
---
# Build

`stacks-build` · Native Stacks · model-invoked

Use when working with the Stacks build system - building component libraries, CLI binaries, server Docker images, documentation, or the framework core. Covers @stacksjs/build, buddy build commands, build actions, and the server build pipeline.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

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
- Package build contracts

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-build
```

Source: [`stacks-build/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-build/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-build/SKILL.md`. See [Using skills](/skills/using).
