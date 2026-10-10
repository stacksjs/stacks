---
title: "DateTime skill"
description: "Use when working with dates and times in Stacks - the DateTime class with Carbon-like API (add/sub, comparison, formatting, start/end of day/month/year), date parsing, format tokens, or timezone handling. Covers @stacksjs/datetime."
---
# DateTime

`stacks-datetime` · Native Stacks · model-invoked

Use when working with dates and times in Stacks - the DateTime class with Carbon-like API (add/sub, comparison, formatting, start/end of day/month/year), date parsing, format tokens, or timezone handling. Covers @stacksjs/datetime.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Architecture
- DateTime Class (`now.ts`)
- Standalone `format()` Function (`format.ts`)
- Standalone `parse()` Function (`parse.ts`)
- Named-zone instants and calendar months
- Current-time helper example
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-datetime
```

Source: [`stacks-datetime/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-datetime/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-datetime/SKILL.md`. See [Using skills](/skills/using).
