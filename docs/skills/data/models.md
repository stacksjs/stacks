---
title: "Models skill"
description: "Use when defining or extending Stacks models, deriving migrations and CRUD, configuring attributes/relationships/traits/ownership, or preserving model inference. Covers defineModel, extendModel, model types, native data workflows, and the 107 built-in framework models."
---
# Models

`stacks-models` · Native Stacks · model-invoked

Use when defining or extending Stacks models, deriving migrations and CRUD, configuring attributes/relationships/traits/ownership, or preserving model inference. Covers defineModel, extendModel, model types, native data workflows, and the 107 built-in framework models.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Writing a model
- Personal data (GDPR)
- Workflow
- Seeding
- Built-in models by category
- CLI Commands
- Gotchas

## Supporting references

- [references/model-capabilities.md](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-models/references/model-capabilities.md)

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-models
```

Source: [`stacks-models/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-models/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-models/SKILL.md`. See [Using skills](/skills/using).
