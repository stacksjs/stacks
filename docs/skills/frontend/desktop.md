---
title: "Desktop skill"
description: "Use when building or publishing desktop applications with Stacks - Craft native windows, local launchers, helper processes, packaging, capability probes, or Mac App Store delivery. Covers @stacksjs/desktop-build and the browser bridge boundary."
---
# Desktop

`stacks-desktop` · Native Stacks · model-invoked

Use when building or publishing desktop applications with Stacks - Craft native windows, local launchers, helper processes, packaging, capability probes, or Mac App Store delivery. Covers @stacksjs/desktop-build and the browser bridge boundary.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Runtime
- API
- Local-first apps: owning the launcher
- Helper processes: one binary, not three
- CLI Commands
- Mac App Store
- Required Apple configuration
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-desktop
```

Source: [`stacks-desktop/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-desktop/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-desktop/SKILL.md`. See [Using skills](/skills/using).
