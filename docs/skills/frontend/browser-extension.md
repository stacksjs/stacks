---
title: "Browser Extension skill"
description: "Use when scaffolding, building, packaging or preparing store submission for a native Stacks MV3 browser extension. Covers @stacksjs/browser-extension and Chrome/Firefox/Safari target boundaries."
---
# Browser Extension

`stacks-browser-extension` · Native Stacks · model-invoked

Use when scaffolding, building, packaging or preparing store submission for a native Stacks MV3 browser extension. Covers @stacksjs/browser-extension and Chrome/Firefox/Safari target boundaries.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Build workflow
- Store preparation and publication

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-browser-extension
```

Source: [`stacks-browser-extension/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-browser-extension/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-browser-extension/SKILL.md`. See [Using skills](/skills/using).
