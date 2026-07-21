---
title: Deploying to the cloud
description: "builds the application, generates its AWS infrastructure, and creates or updates the CloudFormation stack."
---
# Deploying to the cloud

`buddy deploy` builds the application, generates its AWS infrastructure, and creates or updates the CloudFormation stack.

## Prerequisites

```bash
buddy configure:aws
buddy key:generate
buddy env:set APP_URL https://example.com
buddy env:set APP_ENV production
```

Review `config/cloud.ts`, `config/team.ts`, and the hooks in `cloud/deploy-script.ts` before the first deployment.

## Preview and deploy

```bash
buddy cloud --diff
buddy deploy
```

Server mode uses EC2 and an Application Load Balancer. Serverless mode uses Lambda, API Gateway, CloudFront, and S3. Select the mode in `config/cloud.ts`.

CloudFormation deployments include IAM capabilities and roll back failed stack creation. Stacks tags resources with the environment, project, and framework ownership metadata.

## Deployment hooks

```ts
export default {
  beforeDeploy({ environment, region }) {
    console.log(`Deploying ${environment} in ${region}`)
  },

  afterDeploy({ outputs }) {
    console.log(outputs.Endpoint)
  },
}
```

Use hooks for deterministic preflight checks and post-deploy smoke tests. Keep credentials in the environment, never in the hook source.

## Operations

```bash
buddy cloud --ssh
buddy cloud --invalidate-cache
buddy cloud:add --jump-box
```

`buddy cloud:remove` and `buddy cloud:cleanup` are destructive and require confirmation unless `--yes` is supplied intentionally.
