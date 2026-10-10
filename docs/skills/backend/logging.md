---
title: "Logging skill"
description: "Use when implementing logging in Stacks - the log facade (info, error, warn, debug, success), dump/dd debugging, timing functions, file-based logging, or log configuration. Covers @stacksjs/logging and config/logging.ts."
---
# Logging

`stacks-logging` · Native Stacks · model-invoked

Use when implementing logging in Stacks - the log facade (info, error, warn, debug, success), dump/dd debugging, timing functions, file-based logging, or log configuration. Covers @stacksjs/logging and config/logging.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Calls and context
- Shutdown and synchronous paths
- Levels, formats and destinations
- Source and verification

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-logging
```

Source: [`stacks-logging/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-logging/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-logging/SKILL.md`. See [Using skills](/skills/using).
