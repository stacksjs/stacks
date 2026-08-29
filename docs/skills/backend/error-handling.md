---
title: "Error handling skill"
description: "Use when implementing error handling in Stacks."
---
# Error handling

`stacks-error-handling` · Backend and API · model-invoked

The `Result` type, the central error handler, and how errors render: stack traces
in development, friendly pages in production. Also covers HTTP error mapping and
where the log files land.

## When to reach for it

- The Result type (Ok/Err)
- handleError function
- Error page rendering (development with stack traces, production with friendly messages)
- ErrorHandler class
- ModelNotFoundException
- HTTP error mapping
- Log file writing
- Error configuration

## Covers

`@stacksjs/error-handling`, `config/errors.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Result Type (from ts-error-handling)
- Error Handler
- Log File Writing
- Error Page Rendering
- HTTP Error Mapping
- Custom Exceptions
- Error Page Types
- Error Model (storage/framework/defaults/app/Models/Error.ts)
- config/errors.ts
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/error-handling/src/`
- Configuration: `config/errors.ts`
- Error model: `storage/framework/defaults/app/Models/Error.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-error-handling
```

Source: [`stacks-error-handling/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-error-handling/SKILL.md).
Shadow it for one project with `app/Skills/stacks-error-handling/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
