---
title: "Cloud skill"
description: "Use when deploying or managing cloud infrastructure for Stacks - choosing between the AWS, Hetzner and SSH targets, AWS deployment via CloudFormation/CDK, server mode (EC2, ALB, VPC), serverless mode (Lambda, API Gateway, CloudFront), jump boxes, domain management (Route53), S3 storage, SES email, edge computing, security groups, IAM, the rpx gateway and systemd units on an SSH box, or the cloud configuration. Covers @stacksjs/cloud, @stacksjs/deploy, storage/framework/cloud/, and cloud/."
---
# Cloud

`stacks-cloud` · Native Stacks · model-invoked

Use when deploying or managing cloud infrastructure for Stacks - choosing between the AWS, Hetzner and SSH targets, AWS deployment via CloudFormation/CDK, server mode (EC2, ALB, VPC), serverless mode (Lambda, API Gateway, CloudFront), jump boxes, domain management (Route53), S3 storage, SES email, edge computing, security groups, IAM, the rpx gateway and systemd units on an SSH box, or the cloud configuration. Covers @stacksjs/cloud, @stacksjs/deploy, storage/framework/cloud/, and cloud/.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Targets
- Key Paths
- Deployment Modes (AWS)
- Deployment Flow (AWS)
- CloudFront origin failover (AWS)
- Hetzner and SSH targets
- Cloud Helper Functions
- DNS Functions (AWS Route53)
- Server Configuration (cloud/servers.ts)
- Deploy Hooks (cloud/deploy-script.ts)
- CLI Commands
- config/cloud.ts
- Infrastructure Stack (storage/framework/cloud/)
- Gotchas
- Configuration and provider evidence

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-cloud
```

Source: [`stacks-cloud/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-cloud/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-cloud/SKILL.md`. See [Using skills](/skills/using).
