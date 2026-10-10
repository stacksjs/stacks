---
title: "Mobile skill"
description: "Use when building native iOS or Android applications from Stacks and STX with Craft, mobile configuration, native capabilities, device search, health, route recording, safe areas, haptics, or mobile build output. Covers @stacksjs/mobile and the mobile build pipeline."
---
# Mobile

`stacks-mobile` · Native Stacks · model-invoked

Use when building native iOS or Android applications from Stacks and STX with Craft, mobile configuration, native capabilities, device search, health, route recording, safe areas, haptics, or mobile build output. Covers @stacksjs/mobile and the mobile build pipeline.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key paths
- Build
- Configuration
- Device search index
- Runtime API
- STX components
- Appearance and navigation
- Health and watch surfaces
- Validation

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-mobile
```

Source: [`stacks-mobile/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-mobile/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-mobile/SKILL.md`. See [Using skills](/skills/using).
