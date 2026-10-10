---
title: "Deploy skill"
description: "Use when deploying a Stacks application - picking a deploy target (AWS, Hetzner, or a host you own over SSH), the deployment workflow (build → deploy), pre/post deploy hooks, server vs serverless mode selection, first-time deployment setup, rollback, deployment troubleshooting, or the buddy deploy command. For cloud infrastructure details (EC2, Lambda, CloudFormation, Route53, IAM, rpx, systemd), see stacks-cloud. Covers buddy deploy, config/cloud.ts, provider previews, release and rollback."
---
# Deploy

`stacks-deploy` · Native Stacks · model-invoked

Use when deploying a Stacks application - picking a deploy target (AWS, Hetzner, or a host you own over SSH), the deployment workflow (build → deploy), pre/post deploy hooks, server vs serverless mode selection, first-time deployment setup, rollback, deployment troubleshooting, or the buddy deploy command. For cloud infrastructure details (EC2, Lambda, CloudFormation, Route53, IAM, rpx, systemd), see stacks-cloud. Covers buddy deploy, config/cloud.ts, provider previews, release and rollback.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Deploy Targets
- Quick Deploy
- Deployment Prerequisites
- Preview deployments (Hetzner and `ssh`)
- Deployment Flow
- The LAN rule (`provider: 'ssh'` only)
- Deploy Hooks (cloud/deploy-script.ts)
- Deployment Modes
- First Deployment Checklist
- CLI Commands
- Gotchas
- Evidence and infrastructure contract

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-deploy
```

Source: [`stacks-deploy/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-deploy/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-deploy/SKILL.md`. See [Using skills](/skills/using).
