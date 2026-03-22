---
name: stacks-cloud
description: Use when deploying or managing cloud infrastructure for Stacks — AWS deployment via CloudFormation/CDK, server mode (EC2, ALB, VPC), serverless mode (Lambda, API Gateway, CloudFront), jump boxes, domain management (Route53), S3 storage, SES email, edge computing, security groups, IAM, or the cloud configuration. Covers @stacksjs/cloud, @stacksjs/deploy, storage/framework/cloud/, and cloud/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, AWS
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Cloud & Deployment

AWS-focused cloud deployment using CloudFormation via `@stacksjs/ts-cloud`.

## Key Paths
- Cloud package: `storage/framework/core/cloud/src/`
- Deploy package: `storage/framework/core/deploy/src/`
- CDK stacks: `storage/framework/cloud/` (deploy.ts, cdk.json, package.json)
- Cloud config: `cloud/` (serverless.ts, servers.ts, deploy-script.ts)
- TS Cloud config: `.ts-cloud/`
- Configuration: `config/cloud.ts`

## Deployment Modes

### Server Mode (EC2)
- EC2 instances with configurable types (t3.micro, t4g.nano, etc.)
- Application Load Balancer (ALB)
- VPC with public/private subnets
- Security groups with firewall rules
- Auto-scaling capabilities
- SQLite database on instance
- Docker support via Dockerfile

### Serverless Mode (Lambda)
- Lambda functions for API
- API Gateway (REST/WebSocket)
- CloudFront CDN for static assets
- S3 buckets (frontend, docs, logs, assets)
- SQS queues for background jobs
- DynamoDB (optional)

## Deployment Flow

```bash
buddy deploy                    # deploy to cloud
```

1. Validates APP_KEY format (colon-separated)
2. Checks AWS region and credentials
3. Validates app URL, name, team configuration
4. Creates `InfrastructureGenerator` from cloud config
5. Generates CloudFormation template
6. Creates or updates stack with:
   - Capabilities: `CAPABILITY_IAM`, `CAPABILITY_NAMED_IAM`
   - Tags: Environment, Project, ManagedBy
   - OnFailure: ROLLBACK

## Cloud Helper Functions

```typescript
import { getSecurityGroupId, purchaseDomain, hasBeenDeployed, isFirstDeployment, isFailedState } from '@stacksjs/cloud'

// Domain management
await purchaseDomain('example.com', { years: 1, privacy: true, autoRenew: true })

// Infrastructure queries
const sgId = await getSecurityGroupId('my-sg')
const jumpBoxId = await getJumpBoxInstanceId('stack-name')
const deployed = await hasBeenDeployed()
const firstDeploy = await isFirstDeployment()
const failed = await isFailedState()

// Resource management
await addJumpBox('stack-name')
await deleteJumpBox('stack-name')
await deleteEc2Instance(instanceId, 'stack-name')

// Cleanup
await deleteStacksBuckets()
await deleteStacksFunctions()
await deleteLogGroups()
await deleteParameterStore()
await deleteVpcs()
await deleteCdkRemnants()
await deleteIamUsers()
await deleteSubnets()
```

## DNS Functions (AWS Route53)

```typescript
import { createHostedZone, deleteHostedZone, findHostedZone, getNameservers, updateNameservers } from '@stacksjs/cloud'

const zone = await createHostedZone('example.com')
const zoneId = await findHostedZone('example.com')
const ns = await getNameservers('example.com')
const hostedNs = await getHostedZoneNameservers('example.com')
await updateNameservers(hostedNs, 'example.com')
await deleteHostedZoneRecords('example.com')
await writeNameserversToConfig(nameservers)
```

## Server Configuration (cloud/servers.ts)

```typescript
export default [
  {
    name: 'app-server-1',
    domain: 'stacksjs.com',
    region: 'us-east-1',
    type: 'app',              // 'app' | 'web' | 'cache' | 'worker' | 'search'
    instance: 't3.micro',
    disk: 20,                  // GB
    os: 'ubuntu-20-lts-x86_64',
    bun: '1.1.26',
    database: { type: 'sqlite', name: 'stacks' }
  },
  // ... more servers
]
```

## Deploy Hooks (cloud/deploy-script.ts)

```typescript
export default {
  beforeDeploy({ environment, region }) {
    // Pre-deployment: build assets, validate, notify
  },
  afterDeploy({ environment, region, outputs }) {
    // Post-deployment: cache warming, smoke tests, database seeding
    console.log('Public IP:', outputs.PublicIp)
    console.log('DNS:', outputs.DNS)
  }
}
```

## CLI Commands

```bash
buddy deploy                          # deploy application
buddy cloud --diff                    # show infrastructure changes
buddy cloud --ssh                     # SSH into cloud
buddy cloud --invalidate-cache        # invalidate CDN
buddy cloud:add --jump-box            # add jump box instance
buddy cloud:remove --force            # destroy cloud resources
buddy cloud:cleanup                   # clean retained resources
buddy cloud:optimize-cost             # remove optional resources
buddy domains:purchase <domain>       # purchase domain via Route53
buddy domains:add <domain>            # add existing domain
buddy domains:remove <domain>         # remove domain
```

## config/cloud.ts

```typescript
{
  project: { name: 'my-app', slug: 'my-app', region: 'us-east-1' },
  mode: 'server',             // 'server' | 'serverless'
  environments: {
    production: { domain: 'app.com', region: 'us-east-1' },
    staging: { domain: 'staging.app.com' }
  },
  infrastructure: {
    compute: { type: 't3.micro', spot: false },
    loadBalancer: { enabled: true, type: 'application' },
    ssl: { enabled: true },
    dns: { provider: 'route53' },
    storage: { buckets: [] },
    cdn: { enabled: true },
    cache: { enabled: false },
    queue: { enabled: false }
  }
}
```

## Infrastructure Stack (storage/framework/cloud/)

- `deploy.ts` — Main deployment script (CDK app entry)
- `cdk.json` — CDK configuration with 54 AWS context settings
- `package.json` — Cloud package dependencies

Stack naming: `{slugified-app-name}-cloud`

## Gotchas
- AWS credentials MUST be configured (`buddy configure:aws` or env vars)
- Default region is `us-east-1` (from AWS_DEFAULT_REGION env)
- APP_KEY must be colon-separated format (validated during deployment)
- Server mode uses EC2 + ALB; serverless uses Lambda + API Gateway + CloudFront
- Jump boxes are optional — used for SSH access to private instances
- `cloud:remove` with `--force` skips confirmation — destructive operation
- CDK toolkit stack is named `stacks-toolkit`
- Environment mapping: `local` → `development`, others preserved
- Deploy hooks run before/after deployment for custom logic
- The cloud package has its own `package.json` with framework dependencies
