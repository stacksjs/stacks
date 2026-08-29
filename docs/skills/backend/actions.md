---
title: "Actions skill"
description: "Use when working with Stacks server actions."
---
# Actions

`stacks-actions` · Backend and API · model-invoked

Actions are the unit of work behind a route. This covers writing them in
`app/Actions/`, the ones the `useApi` trait generates for free, and the 80+
default actions the framework ships that you can call or override.

## When to reach for it

- Creating actions in app/Actions/
- Auto-generated API actions from the useApi model trait
- The 80+ default framework actions (auth, dashboard, commerce, content, deployment, jobs)
- Action request/response handling
- Action registration

## Covers

`@stacksjs/actions`, `storage/framework/defaults/app/Actions/`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Creating an Action
- Resource Action Contract
- Auto-Generated API Actions (useApi Trait)
- Default Framework Actions (80+)
- Action Handler Pattern
- Using Actions in Routes
- CLI Commands
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/actions/src/`
- Application actions: `app/Actions/`
- Default framework actions: `storage/framework/defaults/app/Actions/`
- Framework actions (generated): `storage/framework/actions/`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-actions
```

Source: [`stacks-actions/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-actions/SKILL.md).
Shadow it for one project with `app/Skills/stacks-actions/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
