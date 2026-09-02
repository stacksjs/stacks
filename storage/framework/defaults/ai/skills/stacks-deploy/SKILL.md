---
name: stacks-deploy
description: Use when deploying a Stacks application - picking a deploy target (AWS, Hetzner, or a host you own over SSH), the deployment workflow (build → deploy), pre/post deploy hooks, server vs serverless mode selection, first-time deployment setup, rollback, deployment troubleshooting, or the buddy deploy command. For cloud infrastructure details (EC2, Lambda, CloudFormation, Route53, IAM, rpx, systemd), see stacks-cloud.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, AWS / Hetzner / any 64-bit Debian or Ubuntu host over SSH
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Deployment

The deployment workflow for Stacks applications.

## Deploy Targets

`cloud.provider` in `config/cloud.ts` decides where `buddy deploy` ships. `CLOUD_PROVIDER` in the
environment overrides it. With neither set, the provider is `aws`.

| `cloud.provider` | Target | What the deploy does |
|---|---|---|
| `'aws'` (default) | AWS | Generates infrastructure, creates or updates a CloudFormation stack |
| `'hetzner'` | Hetzner Cloud | Provisions the server through the Hetzner API, then deploys over SSH |
| `'ssh'` | A host you already own | Adopts and bootstraps the host over SSH, then deploys to it |

Read the repo's own `config/cloud.ts` before assuming a target. This repo uses `'hetzner'`.

Hetzner and `ssh` share one pipeline: a release tarball copied over SSH, systemd units per site,
and the rpx gateway in front. They differ in whether a server is created for you. AWS is a
different pipeline entirely.

## Quick Deploy

```bash
buddy deploy
```

Preview the complete environment-aware plan before changing anything:

```bash
buddy deploy --dry-run
buddy deploy staging --dry-run
buddy deploy --dry-run --site docs
buddy deploy --dry-run --json
```

The preview uses the same environment transformation and ts-cloud site classification as a real
deploy. It reports the ordered validation, infrastructure, build, package, release, runtime,
gateway, DNS, TLS, and optional container operations. It exits before prerequisite setup, builds,
packaging, hooks, provider calls, persistence, DNS, TLS, or service restarts. The JSON form emits
a versioned `STACKS_DEPLOY_PREVIEW_JSON=` line for API and tool consumers.

## Deployment Prerequisites

**AWS** (`provider: 'aws'`)

1. **AWS credentials configured**: `buddy configure:aws`
2. **APP_KEY generated**: `buddy key:generate` (must be colon-separated format)
3. **APP_URL set** in `.env`
4. **Team configured** in `config/team.ts`

**Hetzner** (`provider: 'hetzner'`)

1. `HCLOUD_TOKEN` in the environment, or `hetzner.apiToken` in `config/cloud.ts`
2. `~/.ssh/id_ed25519.pub` on the machine deploying: the driver registers it on the server

**SSH** (`provider: 'ssh'`)

1. A host in `ssh.hosts`, or `TS_CLOUD_SSH_HOST` in the environment
2. A key that reaches it, and passwordless sudo when the user is not root
3. `buddy server:doctor` clean

## Deployment Flow

**AWS**

1. **Validation**: checks APP_KEY format, AWS region, app URL, team config
2. **Build**: compiles application for production
3. **Infrastructure**: generates CloudFormation template via ts-cloud
4. **Deploy**: creates or updates the CloudFormation stack
   - Capabilities: CAPABILITY_IAM, CAPABILITY_NAMED_IAM
   - OnFailure: ROLLBACK
   - Tags: Environment, Project, ManagedBy

**Hetzner and SSH**

1. **Validation**: same prerequisite checks, plus the ts-cloud persistent-state capability check
2. **Infrastructure**: Hetzner creates or reuses the server; SSH checks and bootstraps the host
3. **Build and package**: builds each site, packages a release tarball
4. **Release**: copies over SSH, installs systemd units, restarts, preserves the prior release
5. **Gateway**: writes `/etc/rpx/sites.d/<slug>.json`
6. **DNS and TLS**: reconciles A records and issues certificates, when publishing is allowed

## The LAN rule (`provider: 'ssh'` only)

An SSH host on a private address publishes no DNS, requests no Let's Encrypt certificate, skips
the CDN and skips mail reconciliation. It prints the LAN URLs instead.

Private means RFC1918, `100.64/10` CGNAT, loopback, link-local, IPv6 unique-local or link-local,
a `.local` / `.internal` / `.lan` / `.intranet` / `.home.arpa` name, or a bare single-label
hostname. Publishing an A record for `192.168.1.42` would point every visitor's browser at
whatever occupies that address on their own network, and an ACME challenge cannot reach a host
the internet cannot route to.

To publish: give the host a routable address, forward 80 and 443 to it, declare a domain on a
site, and set `ssh.publicIp` (`'auto'` discovers it at deploy time). `TS_CLOUD_SSH_PUBLISH_DNS=1`
forces publishing on for a host behind a port forward the deploy cannot see; `0` forces it off.

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

Modes apply to the AWS target.

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
# 1. Configure the provider
buddy configure:aws          # aws
# hetzner: set HCLOUD_TOKEN
# ssh:     buddy server:doctor, then buddy server:setup

# 2. Generate app key
buddy key:generate

# 3. Set environment variables
buddy env:set APP_URL https://myapp.com
buddy env:set APP_ENV production

# 4. Review cloud config
# Edit config/cloud.ts

# 5. Preview, then deploy
buddy deploy --dry-run
buddy deploy
```

## CLI Commands

```bash
buddy deploy [env]            # deploy; env is production | staging | development
buddy deploy --prod           # same, by flag (--staging, --dev)
buddy deploy --dry-run        # preview without changing anything
buddy deploy --site <name>    # deploy one site to the existing server
buddy deploy --domain <d>     # override the domain this deploy publishes
buddy deploy --yes            # skip confirmation (required in CI)
buddy deploy:rollback [site]  # activate a preserved release (--env, --to, --dry-run)
buddy server:doctor           # preflight an ssh host
buddy server:setup            # adopt and bootstrap an ssh host
buddy cloud --diff            # preview infrastructure changes before deploying
buddy cloud --ssh             # SSH into deployed server
buddy cloud:remove            # tear down infrastructure (alias: undeploy)
buddy cloud:cleanup           # clean retained resources
```

## Gotchas
- Check `cloud.provider` before advising anything provider-specific. Half the AWS advice is wrong
  for a Hetzner or SSH box, and vice versa.
- `buddy deploy --prod` from a non-interactive shell refuses without `--yes`, rather than hanging
  on the confirmation prompt.
- APP_KEY must be colon-separated format (validated during deployment)
- `buddy cloud --diff` shows changes BEFORE deploying, and only for AWS
- Deploy hooks run in the deployment process on your machine, not on the target server
- On Hetzner and SSH, a project's `/etc/rpx/sites.d/<slug>.json` is replaced wholesale, so
  `project.slug` must be unique on a shared box and the config must declare every domain that
  fragment serves
- `.env.<environment>` is decrypted at deploy time and shipped as every site's `.env`, so declare
  `tenants` in `config/cloud.ts` on a shared box to strip other tenants' keys
- For infrastructure details, see the `stacks-cloud` skill
