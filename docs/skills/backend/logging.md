---
title: "Logging skill"
description: "Use when implementing logging in Stacks."
---
# Logging

`stacks-logging` · Backend and API · model-invoked

The `log` facade, the `dump` and `dd` debugging helpers, timing functions, and
where log files are written.

## When to reach for it

- The log facade (info, error, warn, debug, success)
- dump/dd debugging
- Timing functions
- File-based logging
- Log configuration

## Covers

`@stacksjs/logging`, `config/logging.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Log Facade
- Dump & Die
- Timing
- Logger Instance
- config/logging.ts
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/logging/src/`
- Configuration: `config/logging.ts`
- Log model: `storage/framework/defaults/app/Models/Log.ts`
- Log file: `storage/logs/stacks.log`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-logging
```

Source: [`stacks-logging/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-logging/SKILL.md).
Shadow it for one project with `app/Skills/stacks-logging/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
