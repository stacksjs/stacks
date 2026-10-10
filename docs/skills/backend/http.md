---
title: "HTTP skill"
description: "Use when choosing HTTP status constants, bounded fetch, outbound Httx requests, transport fakes, retry/circuit behavior, or the boundary with reactive browser fetching. Covers @stacksjs/http and @stacksjs/httx."
---
# HTTP

`stacks-http` · Native Stacks · model-invoked

Use when choosing HTTP status constants, bounded fetch, outbound Httx requests, transport fakes, retry/circuit behavior, or the boundary with reactive browser fetching. Covers @stacksjs/http and @stacksjs/httx.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Native package
- Httx client and fluent requests
- Browser requests
- CLI and evidence

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-http
```

Source: [`stacks-http/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-http/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-http/SKILL.md`. See [Using skills](/skills/using).
