---
title: "DateTime skill"
description: "Use when working with dates and times in Stacks."
---
# DateTime

`stacks-datetime` · Utilities · model-invoked

A Carbon-like `DateTime` class: add and subtract, compare, format, start and end
of day, month and year, parsing and timezones.

## When to reach for it

- The DateTime class with Carbon-like API (add/sub, comparison, formatting, start/end of day/month/year)
- Date parsing
- Format tokens
- Timezone handling

## Covers

`@stacksjs/datetime`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Architecture
- DateTime Class (`now.ts`)
- Standalone `format()` Function (`format.ts`)
- Standalone `parse()` Function (`parse.ts`)
- `now()` Helper
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/datetime/src/`
- Package: `@stacksjs/datetime`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-datetime
```

Source: [`stacks-datetime/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-datetime/SKILL.md).
Shadow it for one project with `app/Skills/stacks-datetime/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
