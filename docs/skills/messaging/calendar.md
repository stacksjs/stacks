---
title: "Calendar skill"
description: "Use when working with calendar functionality in Stacks."
---
# Calendar

`stacks-calendar` · Messaging · model-invoked

Calendar links for Google, Outlook, Yahoo and ICS, including timezone handling and
all-day events.

## When to reach for it

- Exporting events to Google Calendar
- Outlook
- Yahoo
- ICS format
- The CalendarLink interface for event definitions
- Timezone handling
- All-day events
- Calendar URL generation

## Covers

`@stacksjs/calendar-api`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Export Functions
- CalendarLink Interface
- Calendar Store Types
- All-Day Events
- Format Differences
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/calendar-api/src/`
- Package: `@stacksjs/calendar-api`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-calendar
```

Source: [`stacks-calendar/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-calendar/SKILL.md).
Shadow it for one project with `app/Skills/stacks-calendar/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
