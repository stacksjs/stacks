---
title: Extend the Cloud
description: "How to add infrastructure Stacks does not declare for you: extra services on the box, extra AWS resources beside the generated template, and deploy-time hooks."
---
# Extend the Cloud

::: warning What this page used to say
This page documented a pluggable `CloudProvider` interface, custom AWS CDK
constructs, a `Stack` class to subclass, and a `hooks` registry - roughly 550
lines of it. None of that exists
([#2581](https://github.com/stacksjs/stacks/issues/2581)).

Providers are a closed set in ts-cloud (`'aws' | 'hetzner' | 'ssh'`); adding one
means a PR to [ts-cloud](https://github.com/stacksjs/ts-cloud), not a class in
your application. CDK was replaced by ts-cloud's `InfrastructureGenerator`,
which emits CloudFormation directly, so there is no construct to extend.

What follows is how to actually extend a deployment.
:::

## The extension points

There are four, in rough order of how often you want them:

1. **Config** - most "extension" is a key you have not set yet.
2. **Sites** - extra processes the deploy runs and the proxy routes to.
3. **Managed services** - databases and brokers installed on the box.
4. **Your own resources** - anything the generator does not model, applied
   beside the stack.

## 1. Config first

`config/cloud.ts` covers more than most applications use. Before writing
anything, check whether the key exists - the shipped file documents every one
inline, with worked examples for mixed instance fleets, spot capacity,
auto-scaling and monitoring thresholds.

```typescript
infrastructure: {
  compute: {
    instances: 3,
    size: 'medium',

    // Scale on load rather than by hand.
    autoScaling: { min: 2, max: 10, scaleUpThreshold: 70 },

    // Deploy-time installs can briefly exceed physical headroom on a busy
    // box; swap prevents a box-wide OOM cascade.
    swapGb: 4,

    autoUpdates: true,
    webServer: 'rpx',
    monitoring: {
      enabled: true,
      alerts: { cpuLoadPerCore: 1.5, memPercent: 85, diskPercent: 80 },
    },
  },
},
```

::: tip Check the key is read, not just documented
The shipped `config/cloud.ts` carries `@example` blocks for `fleet` and
`spotConfig` that nothing in ts-cloud or the deploy actually reads. A key you
cannot find in the provider's code is a key that does nothing.
:::

## 2. Extra services, as sites

A site is any process the deploy should run and the proxy should route to. It
does not have to be a web application - anything with a start command and a port
works:

```typescript
sites: {
  main: {
    root: '.',
    path: '/',
    domain: 'myapp.com',
    start: 'bun storage/framework/runtime/production/serve.js',
    port: 3000,
  },

  // A second process on the same box, on its own subdomain.
  admin: {
    root: '.',
    domain: 'admin.myapp.com',
    start: 'bun app/admin/serve.ts',
    port: 3010,
  },
},
```

Each becomes a systemd unit, so it restarts on failure and on reboot without
anything further.

::: warning Pick ports from what is listening, not from config
On a shared box two tenants can bind the same port and only one wins, silently.
Check `ss -lntp` on the server before choosing, rather than scanning config
files - a port that no config mentions may still be in use.
:::

::: warning A site's domain is a DNS contract
The gateway routes by hostname. A site whose domain has no DNS record pointing
at the box does not 404 - the request arrives with a hostname the gateway does
not know and falls through to whichever site answers first, serving another
site's content under another site's certificate.
:::

## 3. Managed services on the box

Databases and brokers that should live on the instance are declared under
`compute.managedServices`. The deploy installs and configures them:

```typescript
infrastructure: {
  compute: {
    managedServices: {
      vitess: {
        mode: 'cluster',
        cell: 'zone1',
        keyspaces: [{ name: 'myapp', sharded: false }],
        vtgatePort: 15306,
        username: 'myapp',
        password: String(env.MYAPP_DB_PASSWORD || ''),
        // Bind to loopback unless something off-box genuinely needs it.
        bindAddress: '127.0.0.1',
      },
    },
  },
},
```

Anything reachable from outside also needs its port in `compute.firewall`, which
is reconciled to the declaration on every deploy.

## 4. Resources the generator does not model

For anything outside the model, generate the template and apply your own
resources beside it. `Cloud` gives you the CloudFormation the deploy would use:

```typescript
import { Cloud } from '@stacksjs/cloud'
import cloudConfig from '../config/cloud'

const cloud = new Cloud(cloudConfig, { appEnv: 'production' })
const template = JSON.parse(cloud.generate())

// Inspect what Stacks declares, then manage the rest as its own stack.
console.log(Object.keys(template.Resources))
```

Keep them in a separate stack rather than editing the generated one: the
generated template is rewritten from config on every deploy, so an edit to it
survives exactly until the next `buddy deploy`.

## Deploy-time work

There is no hooks registry. Work that has to happen around a deploy belongs in
one of the places that already runs:

- **Before the app starts** - a site's `preStart` list, whose commands run in order on the server in
  the deployed directory. This is where migrations and one-time setup go.
- **After a deploy** - a job or command invoked by CI after `buddy deploy`
  returns.
- **On a schedule** - `app/Scheduler.ts`.

```typescript
sites: {
  main: {
    root: '.',
    domain: 'myapp.com',
    start: 'bun storage/framework/runtime/production/serve.js',
    port: 3000,
    // Runs on the server before the service starts. Create any directory the
    // app expects: the deployed tree contains only what the packager shipped.
    preStart: ['mkdir -p storage/logs', 'bun install', 'bun buddy migrate'],
  },
},
```

## Multi-region

Regions are per environment, so a second region is a second environment
deploying the same codebase:

```typescript
environments: {
  production: {
    type: 'production',
    deployBranch: 'main',
    region: 'us-east-1',
  },
  productionEu: {
    type: 'production',
    deployBranch: 'main',
    region: 'eu-west-1',
    domainPrefix: 'eu',
  },
},
```

```bash
buddy deploy --env production
buddy deploy --env productionEu
```

Routing between them is DNS - latency or geolocation records in
`infrastructure.dns` - not something the deploy decides.

## Adding a provider

Providers are `'aws' | 'hetzner' | 'ssh'`, defined in
[ts-cloud](https://github.com/stacksjs/ts-cloud). A new one is a PR there rather
than a class in your application, because the generator has to know how to emit
resources for it - an interface an application implements could not do that.

`'ssh'` is the escape hatch in the meantime: it deploys to a machine you already
have, wherever it is, over SSH.

## Related

- [@stacksjs/cloud](/packages/cloud) - the package reference
- [Deployment](/guide/cloud/deployment) - the deploy workflow
- [Deploy how-to](/bootcamp/how-to/deploy) - a first deployment, start to finish
