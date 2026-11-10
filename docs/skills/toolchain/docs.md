---
title: "Docs skill"
description: "Use when auditing, writing, building or configuring Stacks documentation, including source accuracy, generated references, snippets, links, navigation and metadata."
---
# Docs

`stacks-docs` · Native Stacks · model-invoked

Use when auditing, writing, building or configuring Stacks documentation, including source accuracy, generated references, snippets, links, navigation and metadata.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Source Files
- API
- Meta Exports
- Configuration (config/docs.ts)
- CLI Commands
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-docs
```

Source: [`stacks-docs/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-docs/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-docs/SKILL.md`. See [Using skills](/skills/using).
