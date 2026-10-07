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

Every pull request can run as its own copy of the app at `pr-<number>.<preview domain>`, on the
app's own Hetzner or `ssh` box, and disappear when the pull request closes.

```bash
buddy deploy:preview pr-123
buddy deploy:preview:remove pr-123
```

A preview is its own project as far as the box is concerned: slug `<slug>-pr-123`, attached to the
app's box like any tenant. That is what isolates it:

- its gateway route, services and files carry the preview's slug, so deploying or removing it
  never touches the app's
- a relative SQLite path lands in the preview's own data directory, so each preview has its own
  database without any setup
- its secrets come from `.env.preview` alone, never layered over `.env.production`, so a pull
  request cannot reach production data. The deploy refuses to run without that file.

Set it up once:

1. Choose a domain for previews, with its DNS at a provider the deploy has keys for, and set
   `cloud.previews.domain` in `config/cloud.ts` (or `PREVIEW_DOMAIN`).
2. Create `.env.preview` with its own credentials: `buddy env:set --file .env.preview APP_KEY ...`
3. `cloud.previews.site` picks which site to preview; the first one that runs a server is the
   default. `--base staging` puts a preview on the staging box instead of production's.

New apps ship `.github/workflows/preview.yml`. It deploys on every push to a pull request,
keeps the URL in one comment on it, and removes the preview on close. Pull requests from forks
are skipped, since deploying a fork's code with the app's secrets would hand those secrets over.
It needs `DEPLOY_SSH_KEY` and `DOTENV_PRIVATE_KEY_PREVIEW` as secrets and `PREVIEW_DOMAIN` as a
repository variable.

Removing a preview stops and deletes its services, its gateway route and certificate units, its
files and data directory, and its DNS records, by their exact names. Another preview whose name
starts the same way, such as `pr-1-docs` beside `pr-1`, is left alone.

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
