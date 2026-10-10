---
title: "Actions skill"
description: "Use when working with Stacks server actions - creating actions in app/Actions/, auto-generated API actions from the useApi model trait, the 663 default framework actions (auth, dashboard, commerce, content, deployment, jobs), action request/response handling, or action registration. Covers @stacksjs/actions and storage/framework/defaults/app/Actions/."
---
# Actions

`stacks-actions` · Native Stacks · model-invoked

Use when working with Stacks server actions - creating actions in app/Actions/, auto-generated API actions from the useApi model trait, the 663 default framework actions (auth, dashboard, commerce, content, deployment, jobs), action request/response handling, or action registration. Covers @stacksjs/actions and storage/framework/defaults/app/Actions/.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Creating an Action
- Validation, lifecycle, and typed clients
- Resource Action Contract
- Auto-Generated API Actions (useApi Trait)
- Default framework action families
- Action Handler Pattern
- Using Actions in Routes
- CLI Commands
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-actions
```

Source: [`stacks-actions/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-actions/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-actions/SKILL.md`. See [Using skills](/skills/using).
