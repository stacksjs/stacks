---
title: "Newsletter skill"
description: "Use when managing native subscriber lists, opt-in/unsubscribe, campaigns, scheduled delivery, variants, idempotency, or delivery usage. Covers @stacksjs/newsletter and the native marketing bundle."
---
# Newsletter

`stacks-newsletter` · Native Stacks · model-invoked

Use when managing native subscriber lists, opt-in/unsubscribe, campaigns, scheduled delivery, variants, idempotency, or delivery usage. Covers @stacksjs/newsletter and the native marketing bundle.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Lifecycle

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-newsletter
```

Source: [`stacks-newsletter/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-newsletter/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-newsletter/SKILL.md`. See [Using skills](/skills/using).
