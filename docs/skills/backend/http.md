---
title: "HTTP skill"
description: "Use when working with HTTP utilities in a Stacks application."
---
# HTTP

`stacks-http` · Backend and API · model-invoked

HTTP status codes, outbound requests through the `HttxClient`, and the reactive
fetch composables that call them from a template.

## When to reach for it

- HTTP status codes
- Making outbound HTTP requests via HttxClient
- Reactive fetch composables (useFetch/createFetch)
- HTTP-related helpers

## Covers

`@stacksjs/http`, `@stacksjs/httx`, the fetch composables in @stacksjs/composables.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- Response Enum — HTTP Status Codes (index.ts)
- HttxClient — Outbound HTTP Client (@stacksjs/httx)
- useFetch — Reactive Fetch Composable (@stacksjs/composables)
- createFetch — Pre-configured Fetch Factory (@stacksjs/composables)
- CLI Command — buddy http
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/http/src/`
- Composables (useFetch/createFetch): `storage/framework/core/composables/src/useFetch.ts`, `storage/framework/core/composables/src/createFetch.ts`
- Buddy CLI command: `storage/framework/core/buddy/src/commands/http.ts`
- httx dependency (installed): `node_modules/@stacksjs/httx/`
- Package: `@stacksjs/http` (status codes), `@stacksjs/httx` (HTTP client), `@stacksjs/composables` (useFetch/createFetch)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-http
```

Source: [`stacks-http/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-http/SKILL.md).
Shadow it for one project with `app/Skills/stacks-http/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
