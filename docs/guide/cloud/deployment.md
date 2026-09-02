---
title: Deploying to the cloud
description: "buddy deploy builds the application and ships it to one of three targets: AWS, Hetzner Cloud, or a Linux host you own."
---
# Deploying to the cloud

`buddy deploy` builds the application and ships it. Where it ships is decided by one setting,
`cloud.provider` in `config/cloud.ts`.

## The three targets

| `cloud.provider` | Target | How it gets there |
|---|---|---|
| `'aws'` (default) | AWS | Generates the infrastructure and creates or updates a CloudFormation stack |
| `'hetzner'` | A Hetzner Cloud server | Provisions the server through the Hetzner API, then deploys over SSH |
| `'ssh'` | A Linux host you already own | Adopts and bootstraps the host over SSH, then deploys to it |

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
