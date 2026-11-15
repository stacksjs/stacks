---
title: Deploying to the cloud
description: "buddy deploy builds the application and ships it to one of three targets: AWS, Hetzner Cloud, or a Linux host you own."
---
# Deploying to the cloud

`buddy deploy` builds the application and ships it. Where it ships is decided by one setting,
`cloud.provider` in `config/cloud.ts`.

## The targets

| `cloud.provider` | Target | How it gets there |
|---|---|---|
| `'aws'` (default) | AWS | Generates the infrastructure and creates or updates a CloudFormation stack |
| `'hetzner'` | A Hetzner Cloud server | Provisions the server through the Hetzner API, then deploys over SSH |
| `'ssh'` | A Linux host you already own | Adopts and bootstraps the host over SSH, then deploys to it |
| `'fly'` | Fly.io Machines | Builds a container image, pushes it to Fly's registry, and rolls the app's Machines onto it |

`CLOUD_PROVIDER` in the environment overrides the config value. With neither set, the provider is
`aws`.

```ts
// config/cloud.ts
cloud: {
  provider: 'hetzner',
},
```

The Hetzner and `ssh` targets share one pipeline: a release tarball copied over SSH, systemd units
per site, and the rpx gateway in front. They differ in whether a server is created for you.

Preview any target before it changes anything:

```bash
buddy deploy --dry-run
```

## AWS (`provider: 'aws'`)

### Prerequisites

```bash
buddy configure:aws
buddy key:generate
buddy env:set APP_URL https://example.com
buddy env:set APP_ENV production
```

Review `config/cloud.ts`, `config/team.ts`, and the hooks in `cloud/deploy-script.ts` before the
first deployment.

### Preview and deploy

```bash
buddy cloud --diff
buddy deploy
```

Server mode uses EC2 and an Application Load Balancer. Serverless mode uses Lambda, API Gateway,
CloudFront, and S3. Select the mode in `config/cloud.ts`.

CloudFormation deployments include IAM capabilities and roll back failed stack creation. Stacks
tags resources with the environment, project, and framework ownership metadata.

For a site that has to stay up through an S3 or regional outage, give its website bucket a replica
in a second region and let CloudFront fail over to it. See
[CloudFront origin failover](/guide/cloud/origin-failover).

### Operations

```bash
buddy cloud --ssh
buddy cloud --invalidate-cache
buddy cloud:add --jump-box
```

`buddy cloud:remove` and `buddy cloud:cleanup` are destructive and require confirmation unless
`--yes` is supplied intentionally.

## Hetzner Cloud (`provider: 'hetzner'`)

Set `provider: 'hetzner'` and supply a Hetzner API token, either as `hetzner.apiToken` in
`config/cloud.ts` or as `HCLOUD_TOKEN` in the environment.

The deploy registers your local SSH public key on the server, so `~/.ssh/id_ed25519.pub` must
exist. Generate one with `ssh-keygen -t ed25519` if it does not.

```bash
buddy deploy --prod
```

The first deploy creates the server, firewall, SSH key and any managed services. Later deploys
reuse them. DNS records for every site that declares a domain are reconciled against the box
address, and certificates are issued automatically.

Several projects can share one Hetzner box. The owning project deploys normally, and each other
project sets `cloud.attachTo` to the owner's `project.slug`. An attached project skips
provisioning and deploys only its own sites.

Keep the owner's slug out of the tracked file when the repository is public: name the server in the
environment and read it in `config/cloud.ts`, the way the Settlers III remake does.

```typescript
// config/cloud.ts
import type { CloudConfig } from '@stacksjs/ts-cloud'
import process from 'node:process'

// Keep your project's own identity, environments, sites and infrastructure.
export const tsCloud: CloudConfig = {
  project: { name: 'My app', slug: 'my-app', region: 'us-east-1' },
  environments: { production: { type: 'production' } },
  cloud: {
    provider: 'hetzner',
    attachTo: process.env.CLOUD_ATTACH_TO || undefined,
  },
}
```

Set `CLOUD_ATTACH_TO` in the protected deploy environment. The named `tsCloud` export owns this
setting; a flat `attachTo` in the default Stacks wrapper does not configure attachment.

The owning project also keeps its tenant roster private. `buddy deploy` and `buddy env:check`
merge `STACKS_CLOUD_TENANTS` (comma or whitespace separated slugs),
`$STACKS_PRIVATE_DIR/tenants.json`, `~/.config/stacks/tenants.json`, and
`storage/cloud/tenants.json`. Files accept a JSON array or `{ "tenants": [...] }`; the project-local
path is gitignored. A declared `cloud.tenants` in the default wrapper remains available for
private forks. CI that runs these commands supplies `STACKS_CLOUD_TENANTS` from a protected secret,
without printing its value or adding the roster to the workflow.

## A host you own (`provider: 'ssh'`)

Deploy to a Linux box that already exists: a Raspberry Pi on your desk, a rented dedicated server,
a VM someone else provisioned. Nothing is created through a provider API. The host is checked and
bootstrapped in place, then deployed to exactly like the Hetzner box.

```ts
cloud: {
  provider: 'ssh',
},

ssh: {
  profile: 'raspberry-pi',
  hosts: [{ host: 'pi-stacks.local', user: 'pi' }],
  lan: { tls: 'local-ca' },
},
```

Host, user, port and key can also come from `TS_CLOUD_SSH_HOST`, `TS_CLOUD_SSH_USER`,
`TS_CLOUD_SSH_PORT` and `TS_CLOUD_SSH_KEY`. The environment wins over the config.

The one behaviour that differs from Hetzner is what happens on a private address. When the host
sits on a LAN, the deploy publishes no DNS, requests no Let's Encrypt certificate, skips the CDN
and skips mail reconciliation, and prints the LAN URLs instead. Publishing an A record for
`192.168.1.42` would point every visitor's browser at whatever occupies that address on their own
network, and an ACME challenge cannot reach a host the internet cannot route to.

Give the host a routable address, forward ports 80 and 443 to it, declare a domain on a site, and
set `ssh.publicIp`. DNS and certificates then work exactly as they do for Hetzner.

The full walkthrough, including flashing an image, first-boot configuration, trusting the box's
local certificate authority, and troubleshooting, is in
[Deploying to a Raspberry Pi](/guide/cloud/raspberry-pi).

## Fly.io (`provider: 'fly'`)

The app runs as a container image on Fly.io Machines. There is no server to provision and nothing
to reach over SSH.

```ts
cloud: {
  provider: 'fly',
},

fly: {
  regions: ['iad', 'ams'],
  vm: { memoryMb: 1024 },
  volume: { sizeGb: 1, path: '/data' },
  hostnames: ['acme.com'],
},
```

`buddy deploy` then:

1. creates the Fly app (`<slug>-<environment>` unless `fly.app` says otherwise) when it does not
   exist yet, so its registry can take the image
2. builds `storage/framework/Dockerfile` for linux/amd64 and pushes it to
   `registry.fly.io/<app>:<commit>`. Docker has to be installed where the deploy runs
3. sets every value in `.env.<environment>` as a Fly secret, never as plain Machine env
4. gives the app a dedicated IPv6 and a shared IPv4, so `<app>.fly.dev` answers
5. updates each Machine in place under its lease, waiting for it to start before the next, and
   creates the Machines a region is missing, each with its own volume when one is configured
6. requests a certificate for each of `fly.hostnames` and prints the record it needs

It never destroys anything. Machines beyond `fly.count`, or in a region you removed, are reported
and left running, because a Machine can hold the only copy of its volume's data.

The token comes from `FLY_API_TOKEN`. `fly tokens create deploy` makes one scoped to the app, and
an organization token lets the first deploy create the app.

## Preview deployments

Previews currently support one self-contained server runtime with relative SQLite/local state on
an application's Hetzner or SSH box. Multi-runtime applications (including a website plus API),
managed/external databases, Redis-backed state and external writable storage require an explicit
ownership policy that is not implemented yet.

```bash
buddy deploy:preview pr-123
buddy deploy:preview:remove pr-123
```

Before publication scripts, host discovery and the attach deploy, the command checks the cloud
configuration and actual final merged site env. It refuses known unsupported mutable state,
absolute/traversing/symlinked configured paths, explicit shared targets, custom hooks/build/preStart
commands and background workers. Selecting only one site cannot bypass the topology check.

Runtime eligibility and default selection use ts-cloud's native classification: the sole
`server-app` is selected even after bucket/static sites with stale `start`/`port` fields. An explicit
`cloud.previews.site` must name that runtime; selecting bucket/static sites refuses before effects.
A `proxyTo` upstream cannot qualify through stale server fields. Native scheduler inference from
`app/Scheduler.ts`, inherited CDN policy and enabled explicit `config/email.ts` provisioning also refuse before publication.
An effective `scheduler: false` or email `server.enabled: false` remains an opt-out. Accepted
previews run with ancillary reconciliation disabled: no inferred scheduler, management dashboard,
app-wide DNS records, CDN, R2, Workers, mail tenant/health/DNS or mailbox credential persistence.
Only the preview site's ordinary gateway, address DNS and TLS publication remain enabled.
Accepted previews retain their own slug (`<slug>-pr-123`), gateway route, service and release paths;
a relative SQLite file uses the existing preview-scoped shared target.

Set `cloud.previews.domain` (or `PREVIEW_DOMAIN`) and supply a completely readable/decryptable
`.env.preview`. `--base staging` chooses the staging box. `cloud.previews.site` may name the sole
self-contained runtime. The command rejects an incomplete environment file before its explicit
preview cloud config reload. Shared CLI startup can already have evaluated app config.

This is a bounded configuration guard for trusted application code. The native env reader can
expand ambient variables and execute command substitutions, and cloud config itself is executable
code. Ambient variables can still reach config/build evaluation; hardcoded app adapter settings
are not inspected. Neither file existence, different credentials nor an env prefix proves
isolation. Strict env provenance, isolated config/build evaluation and explicit multi-site and
state ownership planning remain pending. Do not use previews for a managed PostgreSQL web/API app.

New apps ship `.github/workflows/preview.yml`, requiring `DEPLOY_SSH_KEY`,
`DOTENV_PRIVATE_KEY_PREVIEW` and `vars.PREVIEW_DOMAIN`. Fork PRs are skipped. The workflow enforces
the same constrained support and does not make arbitrary PR code safe to run with credentials.

Removal cleans the exact implicit native runtime and the legacy first-server target when their
names differ. Explicit site selection retains its historical exact target. All selected runtime
instances and units must stop before gateway/certificate, release and shared data cleanup.
Unit and sibling-preview directories must be readable before any stop or deletion. A failed
listing or stop preserves shared data, DNS and local state. Common cleanup runs once and leaves
sibling preview names alone. Discovery of arbitrary historical target names remains deferred.

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

Use hooks for deterministic preflight checks and post-deploy smoke tests. Keep credentials in the
environment, never in the hook source. Hooks run in the deployment process on your machine, not on
the target server.

## Rolling back

```bash
buddy deploy:rollback
```

Activates a preserved release. `--env <environment>` selects the environment, `--to <release>`
names a specific preserved release, and `--dry-run` previews the change without making it. On the
AWS path, `buddy cloud:remove` tears the stack down instead.

### Separate runtime environments

For SSH, Hetzner and Fly deployments, a project can build a native app and deploy a website from the same top-level
`app/`, `routes/` and `config/` directories. Keep signing credentials out of the
web runtime by selecting its environment file explicitly:

```sh
buddy deploy --prod --env-file .env.web
```

The selected file must exist and decrypt completely. Its own scoped key, such as
`DOTENV_PRIVATE_KEY_WEB`, is used. Deployment never falls back to `.env.production`
and ships only values from the selected file plus the site's declared overrides.
The production branch and release checks still apply.

When transferring a hostname out of an existing host project, remove its site
from that project's configuration and explicitly retire the omitted hostname:

```sh
buddy deploy --prod --site main --retire-domains old.example.com
```

This reconciles the host's own gateway fragment. The independent application
keeps its own repository, deployment workflow, secrets, slug and `cloud.attachTo`
configuration. The hostname need not remain in the host's public source code.
A hostname still declared in the model cannot be retired through this option.
