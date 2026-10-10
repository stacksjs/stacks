---
title: "Analytics skill"
description: "Use when adding analytics to a Stacks application - configuring Fathom, Plausible, Google Analytics or self-hosted analytics, generating tracking scripts, privacy-friendly analytics setup, or the analytics configuration. Covers @stacksjs/analytics and config/analytics.ts."
---
# Analytics

`stacks-analytics` · Native Stacks · model-invoked

Use when adding analytics to a Stacks application - configuring Fathom, Plausible, Google Analytics or self-hosted analytics, generating tracking scripts, privacy-friendly analytics setup, or the analytics configuration. Covers @stacksjs/analytics and config/analytics.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Driver registry
- Drivers
- Driver config interfaces
- config/analytics.ts
- First-party pageview capture
- Dashboard Integration
- Gotchas
- Environment and capture boundaries

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-analytics
```

Source: [`stacks-analytics/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-analytics/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-analytics/SKILL.md`. See [Using skills](/skills/using).
