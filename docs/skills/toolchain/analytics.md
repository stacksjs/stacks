---
title: "Analytics skill"
description: "Use when adding analytics to a Stacks application."
---
# Analytics

`stacks-analytics` · Toolchain · model-invoked

Privacy-friendly analytics through Fathom, Plausible, Google Analytics or a
self-hosted backend, and the tracking script generation behind it.

## When to reach for it

- Configuring Fathom, Plausible or Google Analytics
- Self-hosted analytics
- Generating tracking scripts
- Privacy-friendly analytics setup
- The analytics configuration

## Covers

`@stacksjs/analytics`, `config/analytics.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Driver registry
- Drivers
- Driver config interfaces
- config/analytics.ts
- First-party pageview capture
- Dashboard Integration
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/analytics/src/`
- Drivers: `storage/framework/core/analytics/src/drivers/`
- Registry: `storage/framework/core/analytics/src/registry.ts`
- Configuration: `config/analytics.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-analytics
```

Source: [`stacks-analytics/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-analytics/SKILL.md).
Shadow it for one project with `app/Skills/stacks-analytics/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
