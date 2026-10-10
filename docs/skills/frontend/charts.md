---
title: "Charts skill"
description: "Use when rendering native dashboard charts, configuring scales or tooltips, or managing canvas chart lifecycle. Covers @stacksjs/charts and its Chart.js-compatible subset."
---
# Charts

`stacks-charts` · Native Stacks · model-invoked

Use when rendering native dashboard charts, configuring scales or tooltips, or managing canvas chart lifecycle. Covers @stacksjs/charts and its Chart.js-compatible subset.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Lifecycle and supported behavior

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-charts
```

Source: [`stacks-charts/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-charts/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-charts/SKILL.md`. See [Using skills](/skills/using).
