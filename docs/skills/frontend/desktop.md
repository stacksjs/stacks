---
title: "Desktop skill"
description: "Use when building or publishing desktop applications with Stacks - Craft native windows, system tray, desktop packaging, or Mac App Store delivery."
---
# Desktop

`stacks-desktop` · Frontend · model-invoked

Desktop applications through Craft: native windows, the system tray, packaging and
Mac App Store delivery.

## When to reach for it

- Craft native windows
- System tray
- Desktop packaging
- Mac App Store delivery

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Runtime
- API
- Local-first apps: owning the launcher
- CLI Commands
- Mac App Store
- Required Apple configuration
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/desktop/src/`
- Source: `storage/framework/core/desktop/src/index.ts`
- System tray views: `storage/framework/defaults/views/system-tray/`
- System tray layouts: `storage/framework/defaults/resources/layouts/`
- Package: `@stacksjs/desktop`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-desktop
```

Source: [`stacks-desktop/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-desktop/SKILL.md).
Shadow it for one project with `app/Skills/stacks-desktop/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
