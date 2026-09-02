---
name: stacks-cloud
description: Use when deploying or managing cloud infrastructure for Stacks - choosing between the AWS, Hetzner and SSH targets, AWS deployment via CloudFormation/CDK, server mode (EC2, ALB, VPC), serverless mode (Lambda, API Gateway, CloudFront), jump boxes, domain management (Route53), S3 storage, SES email, edge computing, security groups, IAM, the rpx gateway and systemd units on an SSH box, or the cloud configuration. Covers @stacksjs/cloud, @stacksjs/deploy, storage/framework/cloud/, and cloud/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, AWS / Hetzner / any 64-bit Debian or Ubuntu host over SSH
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Cloud & Deployment

Cloud infrastructure for Stacks, across three deploy targets, all driven through
`@stacksjs/ts-cloud`.

## Targets

`cloud.provider` in `config/cloud.ts` decides which one runs. `CLOUD_PROVIDER` in the environment
overrides it. With neither set, the provider is `aws`.

| `cloud.provider` | Infrastructure | Pipeline |
|---|---|---|
| `'aws'` (default) | CloudFormation stack: EC2/ALB/VPC or Lambda/API Gateway/CloudFront | Template generated and applied |
| `'hetzner'` | One Hetzner Cloud server, firewall, SSH key, managed services | Tarball over SSH, systemd units, rpx gateway |
| `'ssh'` | A host you already own; nothing is provisioned | Same tarball pipeline, after an in-place bootstrap |

Read `config/cloud.ts` before advising anything provider-specific. This repo uses `'hetzner'`.
Most of this page is the AWS target; the Hetzner and SSH sections are marked as such.

## Key Paths
- Cloud package: `storage/framework/core/cloud/src/`
- Deploy package: `storage/framework/core/deploy/`
- CDK stacks: `storage/framework/cloud/` (deploy.ts, cdk.json, package.json)
- Cloud config: `cloud/` (serverless.ts, servers.ts, deploy-script.ts)
- Cloud driver state: `storage/cloud/` (ts-cloud's `stateDir`, set in `config/cloud.ts`)
- Configuration: `config/cloud.ts`

## Deployment Modes (AWS)

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

## Deployment Flow (AWS)

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

## Hetzner and SSH targets

Both deploy the same way once a host exists: build each site, package a release tarball, copy it
over SSH, install and restart systemd units, preserve the prior release, and write this project's
rpx gateway fragment.

```typescript
// config/cloud.ts
cloud: { provider: 'hetzner' },        // HCLOUD_TOKEN or hetzner.apiToken
```

```typescript
cloud: { provider: 'ssh' },
ssh: {
  profile: 'raspberry-pi',             // or 'generic'
  hosts: [{ host: 'pi-stacks.local', user: 'pi', port: 22, privateKeyPath: '~/.ssh/id_ed25519', role: 'app' }],
  hostKey: 'pin',                      // 'pin' | 'accept-new' | 'insecure'
  sudo: true,
  publicIp: 'auto',                    // omit to stay LAN-only
  lan: { hostname: 'pi-stacks.local', tls: 'local-ca' },
},
```

Env beats config for the SSH target: `TS_CLOUD_SSH_HOST`, `TS_CLOUD_SSH_USER`,
`TS_CLOUD_SSH_PORT`, `TS_CLOUD_SSH_KEY`. The first host with no `role`, or `role: 'app'`, is the
one deployed to. Multi-host fleets are not supported.

**The LAN rule.** An SSH host on a private address publishes no DNS, requests no Let's Encrypt
certificate, skips the CDN and skips mail reconciliation, and prints the LAN URLs instead. Private
means RFC1918, `100.64/10` CGNAT, loopback, link-local, IPv6 unique-local or link-local, a
`.local` / `.internal` / `.lan` / `.intranet` / `.home.arpa` name, or a bare single-label
hostname. LAN HTTPS comes from a certificate authority on the box itself (rpx `localCa`), not from
Let's Encrypt. To publish: routable address, ports 80 and 443 forwarded, a site with a domain, and
`ssh.publicIp` set. `TS_CLOUD_SSH_PUBLISH_DNS=1` forces publishing on, `0` forces it off.

**Shared boxes.** Both targets support `cloud.attachTo: '<owner slug>'`. An attached project skips
provisioning and deploys only its own sites. Each project owns `/etc/rpx/sites.d/<slug>.json` and
replaces it wholesale, so `project.slug` must be unique on the box, and the config must declare
every domain that fragment currently serves or the deploy stops.

**State.** `storage/cloud/state/<stack>.json` records the host, SSH user and port, key path, host
key fingerprint, LAN address, profile and staging path. `buddy cloud` builds an `ssh` project's
fleet from the config plus those pins, since there is no provider API to enumerate; status reads
`unknown` because nothing polls the host. `buddy server:doctor` is what asks.

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
buddy deploy:rollback [site]           # activate a preserved release (hetzner/ssh)
buddy server:doctor                   # preflight an ssh host
buddy server:setup                    # adopt and bootstrap an ssh host
buddy cloud --diff                    # show infrastructure changes (aws)
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

- `deploy.ts`: Main deployment script (CDK app entry)
- `cdk.json`: CDK configuration with 54 AWS context settings
- `package.json`: Cloud package dependencies

Stack naming: `{slugified-app-name}-cloud`

## Gotchas
- Check `cloud.provider` first. AWS advice is wrong for a Hetzner or SSH box, and vice versa
- On Hetzner and SSH there is no CloudFormation, no CDK, no stack, and `buddy cloud --diff` has
  nothing to diff
- An SSH host is adopted, never created. `buddy server:doctor` checks it and `buddy server:setup`
  bootstraps it before the first deploy
- A key named in `ssh.hosts[].privateKeyPath` that is not on disk is caught up front now; it used
  to surface much later as a bare `Permission denied (publickey)`
- A Raspberry Pi has no real-time clock, so apt and ACME can both fail in the first minute after
  boot until NTP corrects it
- AWS credentials MUST be configured (`buddy configure:aws` or env vars)
- Default region is `us-east-1` (from AWS_DEFAULT_REGION env)
- APP_KEY must be colon-separated format (validated during deployment)
- Server mode uses EC2 + ALB; serverless uses Lambda + API Gateway + CloudFront
- Jump boxes are optional, used for SSH access to private instances
- `cloud:remove` with `--force` skips confirmation and is destructive
- CDK toolkit stack is named `stacks-toolkit`
- Environment mapping: `local` → `development`, others preserved
- Deploy hooks run before/after deployment for custom logic
- The cloud package has its own `package.json` with framework dependencies
