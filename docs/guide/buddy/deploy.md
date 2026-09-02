---
title: Deploy Command
description: "The  command deploys your Stacks application to cloud infrastructure, handling all aspects of the deployment process including DNS configuration, SSL certi..."
---
# Deploy Command

The `buddy deploy` command deploys your Stacks application to cloud infrastructure, handling all aspects of the deployment process including DNS configuration, SSL certificates, and CDN setup.

## Basic Usage

```bash
# Deploy application
buddy deploy

# Undeploy (remove) application
buddy undeploy
```

## Command Syntax

```bash
buddy deploy [env] [options]
```

The positional `[env]` selects the environment (`production`, `staging`, `development`). The
`--prod`, `--staging` and `--dev` flags do the same thing. With none of them, the deploy targets
production.

### Options

| Option | Description |
|--------|-------------|
| `--domain <domain>` | Override the domain this deploy publishes |
| `-p, --project [project]` | Target a specific project |
| `--prod` | Deploy to production |
| `--staging` | Deploy to staging |
| `--dev` | Deploy to development |
| `--site <name>` | Deploy only this one site to the existing server |
| `--docker` | Also build an OCI image with pantry and push it to the pantry registry |
| `--dry-run` | Preview the plan and exit before anything is changed |
| `--yes` | Skip confirmation prompts |
| `-J, --json` | Emit a machine-readable deployment preview |
| `--verbose` | Enable verbose output |

`--dry-run` evaluates the target environment and the cloud model, then exits before prerequisites,
builds, packaging, hooks, provider calls, persistence, DNS or TLS can change anything. Combined
with `-J` it emits a versioned `STACKS_DEPLOY_PREVIEW_JSON=` line for tools to read.

## Deploy targets

`cloud.provider` in `config/cloud.ts` decides where `buddy deploy` ships. `CLOUD_PROVIDER` in the
environment overrides it. With neither set, the provider is `aws`.

| `cloud.provider` | Target |
|---|---|
| `'aws'` (default) | CloudFormation stack on AWS |
| `'hetzner'` | A Hetzner Cloud server, provisioned through the Hetzner API |
| `'ssh'` | A Linux host you already own, adopted and bootstrapped over SSH |

The Hetzner and `ssh` targets share one pipeline: a release tarball over SSH, systemd units per
site, and the rpx gateway in front. The AWS prerequisites below apply only to `provider: 'aws'`.

For `provider: 'ssh'`, connection details come from `ssh.hosts` in `config/cloud.ts` or from
`TS_CLOUD_SSH_HOST`, `TS_CLOUD_SSH_USER`, `TS_CLOUD_SSH_PORT` and `TS_CLOUD_SSH_KEY`. The
environment wins over the config. A host on a private address publishes no DNS and requests no
certificate; `TS_CLOUD_SSH_PUBLISH_DNS=1` forces publishing on and `0` forces it off. See
[Deploying to a Raspberry Pi](/guide/cloud/raspberry-pi).

## Deployment Process

When you run `buddy deploy`, Stacks:

1. **Validates** configuration and credentials
2. **Builds** your application for production
3. **Provisions** cloud infrastructure (if needed)
4. **Deploys** your application code
5. **Configures** DNS and SSL
6. **Sets up** CDN distribution
7. **Runs** post-deployment tasks

## Prerequisites

These apply to `provider: 'aws'`. A Hetzner deploy needs `HCLOUD_TOKEN` and a local
`~/.ssh/id_ed25519.pub` instead. An `ssh` deploy needs a reachable host and a key.

Before deploying to AWS, ensure you have:

1. **AWS Credentials** configured in `.env.production`:

```bash
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012
```

2. **Application URL** set in your environment:

```bash
APP_URL=your-domain.com
```

3. **Cloud configuration** in `config/cloud.ts`

## Examples

### Basic Deployment

```bash
buddy deploy
```

Output shows CDK-style progress:

```
Deploying application...

stacks-production | 0/15 | 10:30:00 | CREATE_IN_PROGRESS | AWS::CloudFormation::Stack
stacks-production | 1/15 | 10:30:05 | CREATE_COMPLETE    | AWS::S3::Bucket
...
stacks-production | 15/15 | 10:35:00 | CREATE_COMPLETE   | AWS::CloudFormation::Stack

Deployment complete!
```

### Deploy with Verbose Output

```bash
buddy deploy --verbose
```

### Deploy Specific Project

```bash
buddy deploy -p my-project
```

## Environment-Specific Deployment

Deploy to different environments:

```bash
# Deploy to staging
APP_ENV=staging buddy deploy

# Deploy to production
APP_ENV=production buddy deploy
```

## What Gets Deployed

Stacks deploys a complete cloud infrastructure:

### Compute

- Lambda functions for API
- Edge functions for routing

### Storage

- S3 buckets for static assets
- DynamoDB tables (if configured)

### Networking

- VPC and subnets
- CloudFront CDN
- Route 53 DNS records

### Security

- SSL/TLS certificates (ACM)
- IAM roles and policies
- Security groups

## Environment variables on the server

Your `.env.<environment>` is decrypted at deploy time and shipped as each site's
`.env` on the server. Local files (`.env`, `.env.keys`) are never uploaded - the
server gets a generated environment file instead.

Because the whole file goes to every site, anything in it reaches every site.
That matters when several projects share one box.

### Shared boxes and tenant isolation

A box has one owner; other projects attach to it with `cloud.attachTo` and
deploy from their own repositories with their own env files. No project needs
another's values.

In practice a tenant's secrets end up in the owner's env file under a `TENANT_`
prefix - usually pasted in while debugging a deploy - and stay there. Left
alone, deploy writes those secrets into an unrelated site's `.env` on disk.

Declare the tenants attached to your box in `config/cloud.ts`:

```typescript
const config: CloudConfig = {
  tenants: ['bughq', 'analyticshq'],
}
```

`buddy deploy` then drops any `BUGHQ_*` / `ANALYTICSHQ_*` key before shipping
and logs what it dropped, and `buddy env:check` lists them per tenant:

```bash
buddy env:check --file .env.production
```

```
⚠ Tenant isolation          21 key(s) belong to another tenant - move them to .env
⚠   analyticshq             ANALYTICSHQ_APP_KEY, ANALYTICSHQ_DB_PASSWORD, …
⚠   bughq                   BUGHQ_APP_KEY, BUGHQ_STRIPE_SECRET_KEY, …
```

Stripping them at deploy time closes the leak; deleting them from the env file
is still worth doing, since nothing in your project reads them.

Prefixes are never guessed. Without a `tenants` list nothing is treated as
foreign - `STRIPE_`, `AWS_` and `MEILISEARCH_` look identical to a slug prefix.

## DNS Configuration

### Automatic DNS

If your domain is managed by Route 53, DNS is configured automatically.

### External DNS

For domains managed elsewhere, Stacks provides the necessary records:

```
Type: CNAME
Name: www
Value: d1234567890.cloudfront.net

Type: A (Alias)
Name: @
Value: d1234567890.cloudfront.net
```

## Post-Deployment

After successful deployment:

```bash
# Check deployment status
buddy cloud --diff

# View your application
open https://your-domain.com

# SSH into infrastructure (if jump box is added)
buddy cloud --ssh
```

## Rollback

`buddy deploy:rollback` activates a preserved release on the server. Nothing is rebuilt and
nothing is re-uploaded; the previous release directory becomes the active one again.

```bash
buddy deploy:rollback [site] [options]
```

| Option | Description |
|--------|-------------|
| `--env <environment>` | Environment to roll back (default `production`) |
| `--to <release>` | Preserved release id to activate |
| `--dry-run` | Preview the rollback without changing the active release |
| `--verbose` | Enable verbose output |

The optional `[site]` argument limits the rollback to one site. Without `--to`, the previous
preserved release is used.

```bash
# See what would happen
buddy deploy:rollback --dry-run

# Roll one site back to a named release
buddy deploy:rollback docs --to <release>
```

The command delegates to ts-cloud, which owns the preserved releases and their ids. Run it with
`--dry-run` first to see which release ids exist on the server.

On the AWS path there are no preserved release directories. Tear the stack down with
`buddy cloud:remove` and redeploy from the commit you want.

## Undeploy

Remove your cloud infrastructure:

```bash
buddy undeploy
# or
buddy cloud:remove
```

**Warning**: This removes all cloud resources. Data in S3 buckets may be retained.

## Troubleshooting

### AWS Credentials Error

```
Error: AWS credentials are invalid or expired
```

**Solution**:

1. Check credentials in `.env.production`
2. Verify credentials are active in AWS console
3. Ensure proper IAM permissions

### Domain Not Verified

```
Error: Domain verification pending
```

**Solution**:

1. Check email for verification link
2. Add DNS verification records if using external DNS

### Stack Already Exists

```
Error: Stack stacks-production already exists
```

**Solution**:

```bash
# Remove existing stack
buddy cloud:remove

# Wait for removal to complete
# Then redeploy
buddy deploy
```

### Deployment Timeout

```
Error: Deployment timed out
```

**Solution**:

1. Check AWS CloudFormation console for status
2. Review CloudWatch logs for errors
3. Run with `--verbose` for more details

### Missing Environment Variables

```
Error: Required environment variable not set
```

**Solution**:
Ensure all required variables are in your `.env.production`:

```bash
APP_URL=your-domain.com
APP_ENV=production
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
```

## Best Practices

### Pre-Deployment Checklist

1. Run tests: `buddy test`
2. Check types: `buddy test:types`
3. Build locally: `buddy build`
4. Review environment variables
5. Preview changes: `buddy cloud --diff`

### Staging First

Always deploy to staging before production:

```bash
# Deploy to staging
APP_ENV=staging buddy deploy

# Test staging environment
#

# Deploy to production
APP_ENV=production buddy deploy
```

### Monitor Deployments

After deployment:

1. Check CloudWatch logs
2. Monitor CloudFront metrics
3. Test critical paths

## Related Commands

- [buddy cloud](/guide/buddy/cloud) - Cloud management
- [buddy build](/guide/buddy/build) - Build for production
- [buddy domains](/guide/buddy/domains) - Domain management
