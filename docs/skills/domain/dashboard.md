---
title: "Dashboard skill"
description: "Use when building or customizing the Stacks admin dashboard, including dashboard pages, model management views, analytics widgets, commerce dashboards, content management, settings panels, deployment monitoring, job/queue management, or the 413 built-in dashboard components. Covers the dashboard system at storage/framework/defaults/."
---
# Dashboard

`stacks-dashboard` · Domain packages · model-invoked

The admin dashboard: pages, model management views, analytics widgets, commerce
and content surfaces, deployment and queue monitoring, and the 250+ built-in
components behind them.

## Covers

dashboard system at storage/framework/defaults/.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Dashboard Sections
- Dashboard Components (250+)
- Dashboard Actions
- Model Dashboard Integration
- Dashboard Development
- Gotchas

## Where the code lives

- Dashboard components: `storage/framework/defaults/resources/components/Dashboard/`
- Dashboard route views: `storage/framework/defaults/views/dashboard/`
- Dashboard layouts: `storage/framework/defaults/views/dashboard/layouts/`
- Dashboard actions: `storage/framework/defaults/app/Actions/Dashboard/`
- Dashboard page endpoints: `storage/framework/defaults/routes/dashboard-api.ts`
- Dashboard navigation registry: `storage/framework/defaults/resources/functions/dashboard/sidebar.ts`
- Configuration: `config/ui.ts`

## Supporting files

Reference and scripts the skill reaches for on demand, rather than loading up front.

- [`scripts/audit.ts`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-dashboard/scripts/audit.ts)

## Related skills

- [Browse](/skills/craft/browse)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-dashboard
```

Source: [`stacks-dashboard/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-dashboard/SKILL.md).
Shadow it for one project with `app/Skills/stacks-dashboard/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).

## Native source verification

The skill has been checked against current source and retained tests. Read its
entrypoint and linked references for the actual contract; summaries here are
discovery pointers. [Native capabilities](/skills/platform/native) maps every
core package and records driver evidence without claiming universal parity.
