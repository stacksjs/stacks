---
title: "Error handling skill"
description: "Use when implementing error handling in Stacks - the Result type (Ok/Err), handleError function, error page rendering (development with stack traces, production with friendly messages), ErrorHandler class, ModelNotFoundException, HTTP error mapping, log file writing, or error configuration. Covers @stacksjs/error-handling and config/errors.ts."
---
# Error handling

`stacks-error-handling` · Native Stacks · model-invoked

Use when implementing error handling in Stacks - the Result type (Ok/Err), handleError function, error page rendering (development with stack traces, production with friendly messages), ErrorHandler class, ModelNotFoundException, HTTP error mapping, log file writing, or error configuration. Covers @stacksjs/error-handling and config/errors.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Results
- HTTP errors and rendering
- Handling, reporting and shutdown
- Evidence

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-error-handling
```

Source: [`stacks-error-handling/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-error-handling/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-error-handling/SKILL.md`. See [Using skills](/skills/using).
