---
title: "Calendar skill"
description: "Use when exporting calendar links or ICS bodies, building subscribable event feeds, or expanding supported recurrence rules. Covers @stacksjs/calendar-api."
---
# Calendar

`stacks-calendar` · Native Stacks · model-invoked

Use when exporting calendar links or ICS bodies, building subscribable event feeds, or expanding supported recurrence rules. Covers @stacksjs/calendar-api.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Single-event links and files
- Native subscribable feeds
- Recurrence
- Sources and evidence

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-calendar
```

Source: [`stacks-calendar/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-calendar/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-calendar/SKILL.md`. See [Using skills](/skills/using).
