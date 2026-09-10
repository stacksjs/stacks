---
title: "@stacksjs/cloud"
description: "Declarative cloud infrastructure for Stacks: describe what you want in config/cloud.ts, and buddy deploys it."
---
# @stacksjs/cloud

Cloud infrastructure in Stacks is **declarative**. You describe the resources you
want in `config/cloud.ts`; `buddy deploy` reconciles the provider to that
description. There is nothing to call.

::: warning No imperative service API
This page used to document `Compute.deployFunction()`, `Storage.createBucket()`,
`CDN.invalidate()`, `Database.create()`, `Cache`, `Queue`, `SearchEngine`, `AI`,
`Network`, `DNS`, `Security`, `Permissions`, `Monitoring`, `FileSystem` and
`JumpBox` as importable namespaces, and `Cloud.deploy()` as a static method.
None of those has ever existed ([#2581](https://github.com/stacksjs/stacks/issues/2581)).

`Cloud` is a class you construct with a config to GENERATE a CloudFormation
template, and everything else is config plus the `buddy cloud:*` commands.
:::

## Installation

```bash
buddy add @stacksjs/cloud
```

Already installed in a Stacks application.

## Configuration

Everything starts in `config/cloud.ts`.

### Provider and mode

```typescript
// config/cloud.ts
export default {
  project: { name: 'myapp' },

  // Where cloud state (server inventory, deploy pins) is kept.
  stateDir: 'storage/cloud',

  cloud: {
    provider: 'hetzner', // or 'aws'
  },

  // 'server'     - long-running instances (Forge-style)
  // 'serverless' - containers + static sites (Vapor-style)
  mode: 'server',
}
```

### Environments

Each environment carries its own region, branch and variables. The branch is
what makes a push deploy: a commit on `deployBranch` goes to that environment.

```typescript
environments: {
  production: {
    type: 'production',
    deployBranch: 'main',
    region: 'us-east-1',
    variables: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
    },
  },

  staging: {
    type: 'staging',
    deployBranch: 'develop',
    region: 'us-east-1',
    // Prefixes every site's domain, so staging gets staging.example.com.
    domainPrefix: 'staging',
  },
},
```

### Infrastructure

The resources themselves. Declare only what you use - the deployment shape
follows from what is here, so an application with `functions` and no `compute`
deploys serverless without you saying so anywhere.

```typescript
infrastructure: {
  compute: {
    instances: 1,
    size: 'medium',
    disk: { size: 80, type: 'ssd', encrypted: true },

    // Firewalls are RECONCILED to this declaration on every deploy. A port
    // that is open on the box and absent here is closed by the next deploy,
    // even while the service behind it is healthy.
    firewall: {
      enabled: true,
      allowedPorts: [80, 443],
    },

    autoScaling: { min: 1, max: 5, scaleUpThreshold: 70 },
    monitoring: {
      enabled: true,
      alerts: { cpuLoadPerCore: 1.5, memPercent: 85, diskPercent: 80 },
    },
    webServer: 'rpx',
  },

  databases: { /* ... */ },
  storage: { /* ... */ },
  cdn: { /* ... */ },
  dns: { /* ... */ },
  ssl: { /* ... */ },
  loadBalancer: { /* ... */ },
  queues: { /* ... */ },
  functions: { /* ... */ },
  containers: { /* ... */ },
  monitoring: { /* ... */ },
},
```

The shipped `config/cloud.ts` documents every key inline with worked examples -
mixed instance fleets, spot configuration, managed services - and is the
authoritative reference for the shape.

### Sites

One deployment can serve several sites. Each names a root, a domain and how to
start it:

```typescript
sites: {
  main: {
    root: '.',
    path: '/',
    domain: env.APP_DOMAIN || 'example.com',
    start: 'bun storage/framework/runtime/production/serve.js',
    port: 3000,
  },

  docs: {
    root: 'docs',
    path: '/docs',
    domain: 'example.com',
  },
},
```

A site with `start` and `port` becomes a systemd service behind the proxy; one
without is served as static files.

::: warning A site's domain is a DNS contract
The gateway routes by hostname. A site whose domain has no DNS record pointing
at the box does not 404 - the request reaches the gateway with a hostname it
does not recognise and falls through to whichever site answers first, serving
another site's content and another site's certificate.
:::

### Environment variables

```env
# AWS
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# Hetzner
HCLOUD_TOKEN=your-token

# Application
APP_NAME=myapp
APP_ENV=production
APP_DOMAIN=example.com
```

## Deploying

```bash
buddy deploy                      # full workflow: prereqs, env, APP_KEY, DNS, mail records
buddy deploy --env staging        # a specific environment
buddy cloud:diff                  # what the next deploy would change
buddy cloud --ssh                 # shell into the server
buddy cloud:invalidate-cache      # invalidate CloudFront (--paths to scope it)
```

`buddy deploy` is the whole workflow. It checks prerequisites, resolves the
environment, ensures an `APP_KEY`, reconciles the provider, and sets up DNS and
mail records.

### Managing servers

```bash
buddy cloud:add --jump-box        # add a bastion
buddy cloud:attach                # attach this project to a server another project owns
buddy cloud:move                  # move a site to another server, cutting DNS over when it serves
buddy cloud:rename                # rename a server, keeping provider, pin, hostname and inventory in step
buddy cloud:sites                 # every server and what each one hosts, across projects
buddy cloud:destroy               # destroy a drained server, once nothing on it is anyone's rollback
buddy cloud:remove                # remove the cloud entirely
buddy cloud:cleanup               # delete resources retained by a removal
buddy cloud:optimize-cost         # remove resources that can be re-applied later
buddy cloud:dashboard             # local cockpit: servers, sites, deploys
```

## The API

The package exports far less than the configuration surface suggests, because
almost everything is declarative. What it does export:

### `Cloud`

Generates a CloudFormation template from a config. This is the seam the deploy
module uses; it does not talk to a provider itself.

```typescript
import { Cloud } from '@stacksjs/cloud'

const cloud = new Cloud(cloudConfig, { appEnv: 'production' })

const template = cloud.generate()      // CloudFormation JSON
const withApi = cloud.shouldDeployApi()
```

### Deployment state

```typescript
import { hasBeenDeployed, isFailedState, isFirstDeployment } from '@stacksjs/cloud'

if (await isFirstDeployment()) {
  // Nothing exists yet - the first deploy creates rather than updates.
}

if (await isFailedState()) {
  // A previous deploy left the stack mid-update.
}
```

### Jump box

```typescript
import { addJumpBox, deleteJumpBox, getJumpBoxInstanceId } from '@stacksjs/cloud'

await addJumpBox()
const id = await getJumpBoxInstanceId()
await deleteJumpBox()
```

### Teardown helpers

These are what `cloud:remove` and `cloud:cleanup` are built from. Each returns a
`Result`, so a partial teardown reports which resource refused rather than
throwing halfway through:

```typescript
import {
  deleteCdkRemnants,
  deleteEc2Instance,
  deleteIamUsers,
  deleteLogGroups,
  deleteParameterStore,
  deleteStacksBuckets,
  deleteStacksFunctions,
  deleteSubnets,
  deleteVpcs,
} from '@stacksjs/cloud'
```

### Domains and CDN

```typescript
import { getCloudFrontDistributionId, purchaseDomain } from '@stacksjs/cloud'

await purchaseDomain('example.com', { years: 1 })
const distributionId = await getCloudFrontDistributionId()
```

### AWS clients

The hand-rolled clients the mail commands need, re-exported because this package
builds to a single bundled `dist/index.js` and a `@stacksjs/cloud/imap/s3`
subpath would resolve to a file the build never writes:

```typescript
import { AWSClient, S3Client, SecretsManagerClient, SmtpServer, startSmtpServer } from '@stacksjs/cloud'
```

## Handling Deployment Failures

```bash
buddy cloud:diff        # see what changed before retrying
buddy deploy            # retry; it is idempotent
buddy cloud:cleanup     # if a removal left resources behind
```

A failed deploy leaves the stack in a state `isFailedState()` reports. Retrying
is usually right - the reconciliation is idempotent, so a deploy that failed
partway resumes rather than duplicating what it already made.

## Related

- [Deployment](/guide/cloud/deployment) - the deployment workflow end to end
- [Cloud Guide](/guide/cloud) - infrastructure concepts
- [Configuration](/guide/config) - how config files are resolved and overlaid
