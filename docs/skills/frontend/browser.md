---
title: "Browser skill"
description: "Use when working with browser/frontend functionality in Stacks - the useAuth composable (login, register, logout, token management), Stripe billing utilities (loadCardElement, confirmPayment), the API fetch client, browser model loading, or auto-imported browser utilities. Covers @stacksjs/browser."
---
# Browser

`stacks-browser` · Native Stacks · model-invoked

Use when working with browser/frontend functionality in Stacks - the useAuth composable (login, register, logout, token management), Stripe billing utilities (loadCardElement, confirmPayment), the API fetch client, browser model loading, or auto-imported browser utilities. Covers @stacksjs/browser.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Imports and runtime boundary
- Authentication and session recovery
- API transports and errors
- Models, billing and utilities
- Source and evidence

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-browser
```

Source: [`stacks-browser/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-browser/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-browser/SKILL.md`. See [Using skills](/skills/using).
