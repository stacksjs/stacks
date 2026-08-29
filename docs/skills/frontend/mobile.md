---
title: "Mobile skill"
description: "Use when building native iOS or Android applications from a Stacks and STX codebase with Craft, including mobile configuration, native capabilities, safe areas, haptics, sharing, and mobile build output."
---
# Mobile

`stacks-mobile` · Frontend · model-invoked

Native iOS and Android apps: the Craft bridge, mobile builds and the mobile
component set.

## Inside the skill

The sections an agent reads once the skill loads.

- Key paths
- Build
- Configuration
- Runtime API
- STX components
- Health and watch surfaces
- Validation

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-mobile
```

Source: [`stacks-mobile/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-mobile/SKILL.md).
Shadow it for one project with `app/Skills/stacks-mobile/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
