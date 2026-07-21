---
title: Extending cloud infrastructure
description: Stacks keeps application cloud configuration in  and project-specific server definitions in .
---
# Extending cloud infrastructure

Stacks keeps application cloud configuration in `config/cloud.ts` and project-specific server definitions in `cloud/servers.ts`.

## Configure infrastructure

```ts
export default {
  project: {
    name: 'my-app',
    slug: 'my-app',
    region: 'us-east-1',
  },
  mode: 'server',
  infrastructure: {
    compute: { type: 't3.micro', spot: false },
    loadBalancer: { enabled: true, type: 'application' },
    ssl: { enabled: true },
    dns: { provider: 'route53' },
    cdn: { enabled: true },
  },
}
```

Use server mode for persistent processes and WebSockets. Use serverless mode for Lambda-based APIs and event-driven workloads.

## Use cloud helpers

```ts
import {
  addJumpBox,
  getSecurityGroupId,
  hasBeenDeployed,
  purchaseDomain,
} from '@stacksjs/cloud'

const deployed = await hasBeenDeployed()
const securityGroupId = await getSecurityGroupId('my-app')

await addJumpBox('my-app-cloud')
await purchaseDomain('example.com', { years: 1, privacy: true, autoRenew: true })
```

The cloud package also exposes Route 53 hosted-zone helpers and targeted cleanup functions for buckets, functions, log groups, parameters, VPCs, subnets, CDK remnants, and IAM users.

Always run `buddy cloud --diff` after changing infrastructure and review the generated CloudFormation changes before deploying.
