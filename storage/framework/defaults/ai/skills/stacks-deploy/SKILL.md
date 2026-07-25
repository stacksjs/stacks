---
name: stacks-deploy
description: Use when deploying a Stacks application — the deployment workflow (build → deploy), pre/post deploy hooks, server vs serverless mode selection, first-time deployment setup, deployment troubleshooting, or the buddy deploy command. For cloud infrastructure details (EC2, Lambda, CloudFormation, Route53, IAM), see stacks-cloud.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, AWS
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Deployment

The deployment workflow for Stacks applications.

## Quick Deploy

```bash
buddy deploy
```

## Deployment Prerequisites

1. **AWS credentials configured**: `buddy configure:aws`
2. **APP_KEY generated**: `buddy key:generate` (must be colon-separated format)
3. **APP_URL set** in `.env`
4. **Team configured** in `config/team.ts`

## Deployment Flow

1. **Validation** — checks APP_KEY format, AWS region, app URL, team config
2. **Build** — compiles application for production
3. **Infrastructure** — generates CloudFormation template via ts-cloud
4. **Deploy** — creates or updates the CloudFormation stack
   - Capabilities: CAPABILITY_IAM, CAPABILITY_NAMED_IAM
   - OnFailure: ROLLBACK
   - Tags: Environment, Project, ManagedBy

## Deploy Hooks (cloud/deploy-script.ts)

```typescript
export default {
  beforeDeploy({ environment, region }) {
    // Build assets, run tests, send notifications
    console.log(`Deploying to ${environment} in ${region}`)
  },

  afterDeploy({ environment, region, outputs }) {
    // Cache warming, smoke tests, database seeding
    console.log('Public IP:', outputs.PublicIp)
    console.log('DNS:', outputs.DNS)
    console.log('Endpoint:', outputs.Endpoint)
  }
}
```

## Deployment Modes

### Server Mode (default)
- EC2 instances with ALB
- Best for: full-stack apps, WebSocket support, persistent connections
- Config: `config/cloud.ts` → `mode: 'server'`

### Serverless Mode
- Lambda + API Gateway + CloudFront
- Best for: API-only, cost optimization, auto-scaling
- Config: `config/cloud.ts` → `mode: 'serverless'`

## First Deployment Checklist

```bash
# 1. Configure AWS
buddy configure:aws

# 2. Generate app key
buddy key:generate

# 3. Set environment variables
buddy env:set APP_URL https://myapp.com
buddy env:set APP_ENV production

# 4. Review cloud config
# Edit config/cloud.ts

# 5. Deploy
buddy deploy
```

## CLI Commands

```bash
buddy deploy                  # deploy to cloud
buddy cloud --diff            # preview infrastructure changes before deploying
buddy cloud --ssh             # SSH into deployed server
buddy cloud:remove            # tear down infrastructure
buddy cloud:cleanup           # clean retained resources
```

## Gotchas
- First deployment creates the CloudFormation stack — subsequent deploys update it
- APP_KEY must be colon-separated format (validated during deployment)
- Default region is `us-east-1` (from AWS_DEFAULT_REGION env)
- `buddy cloud --diff` shows changes BEFORE deploying — always review first
- Deploy hooks run in the deployment process, not on the target server
- For infrastructure details (EC2, Lambda, VPC, etc.), see the `stacks-cloud` skill
