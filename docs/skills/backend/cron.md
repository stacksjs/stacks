---
title: "Cron skill"
description: "Use when working with cron expressions in a Stacks application - parsing cron syntax, registering OS-level cron jobs, or low-level scheduling. Covers @stacksjs/cron. For higher-level scheduling, see stacks-scheduler."
---
# Cron

`stacks-cron` · Native Stacks · model-invoked

Use when working with cron expressions in a Stacks application - parsing cron syntax, registering OS-level cron jobs, or low-level scheduling. Covers @stacksjs/cron. For higher-level scheduling, see stacks-scheduler.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Source Files
- API
- Types
- Cron Expression Examples
- Gotchas
- Timezone and verification

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-cron
```

Source: [`stacks-cron/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-cron/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-cron/SKILL.md`. See [Using skills](/skills/using).
