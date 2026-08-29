---
title: "Cloud skill"
description: "Use when deploying or managing cloud infrastructure for Stacks."
---
# Cloud

`stacks-cloud` · Toolchain · model-invoked

The AWS infrastructure: CloudFormation and CDK, server mode on EC2 behind an ALB,
serverless mode on Lambda, jump boxes, Route53, S3, SES, edge computing, security
groups and IAM.

## When to reach for it

- AWS deployment via CloudFormation/CDK
- Server mode (EC2, ALB, VPC)
- Serverless mode (Lambda, API Gateway, CloudFront)
- Jump boxes
- Domain management (Route53)
- S3 storage
- SES email
- Edge computing
- Security groups
- IAM
- The cloud configuration

## Covers

`@stacksjs/cloud`, `@stacksjs/deploy`, `storage/framework/cloud/`, `cloud/`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Deployment Modes
- Deployment Flow
- Cloud Helper Functions
- DNS Functions (AWS Route53)
- Server Configuration (cloud/servers.ts)
- Deploy Hooks (cloud/deploy-script.ts)
- CLI Commands
- config/cloud.ts
- Infrastructure Stack (storage/framework/cloud/)
- Gotchas

## Where the code lives

- Cloud package: `storage/framework/core/cloud/src/`
- Deploy package: `storage/framework/core/deploy/`
- CDK stacks: `storage/framework/cloud/` (deploy.ts, cdk.json, package.json)
- Cloud config: `cloud/` (serverless.ts, servers.ts, deploy-script.ts)
- Cloud driver state: `storage/cloud/` (ts-cloud's `stateDir`, set in `config/cloud.ts`)
- Configuration: `config/cloud.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-cloud
```

Source: [`stacks-cloud/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-cloud/SKILL.md).
Shadow it for one project with `app/Skills/stacks-cloud/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
