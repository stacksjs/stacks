---
title: "Docs skill"
description: "Use when building or configuring documentation for a Stacks project - BunPress setup, doc generation, navigation, sidebar structure, or documentation meta/SEO. Covers @stacksjs/docs and config/docs.ts."
---
# Docs

`stacks-docs` · Native Stacks · model-invoked

Use when building or configuring documentation for a Stacks project - BunPress setup, doc generation, navigation, sidebar structure, or documentation meta/SEO. Covers @stacksjs/docs and config/docs.ts.

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
