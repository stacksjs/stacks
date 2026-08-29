---
title: "Deploy skill"
description: "Use when deploying a Stacks application."
---
# Deploy

`stacks-deploy` · Toolchain · model-invoked

The deploy workflow: build then deploy, the pre and post hooks, choosing server or
serverless, first-time setup, and what to do when it fails. Infrastructure detail
is in [Cloud](/skills/toolchain/cloud).

## When to reach for it

- The deployment workflow (build → deploy)
- pre/post deploy hooks
- Server vs serverless mode selection
- First-time deployment setup
- Deployment troubleshooting
- The buddy deploy command

## Inside the skill

The sections an agent reads once the skill loads.

- Quick Deploy
- Deployment Prerequisites
- Deployment Flow
- Deploy Hooks (cloud/deploy-script.ts)
- Deployment Modes
- First Deployment Checklist
- CLI Commands
- Gotchas

## Related skills

- [Cloud](/skills/toolchain/cloud)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-deploy
```

Source: [`stacks-deploy/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-deploy/SKILL.md).
Shadow it for one project with `app/Skills/stacks-deploy/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
