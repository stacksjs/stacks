---
title: Cloud Jump Box
description: Add a temporary bastion host for controlled access to private cloud resources.
---
# Jump Box

A jump box provides a controlled entry point to resources that are not publicly reachable. It is part of your stack: declare it only while private-network access is required, in the `tsCloud` export of `config/cloud.ts`, and deploy:

```ts
infrastructure: {
  jumpBox: { allowedCidrs: ['203.0.113.0/24'] },
},
```

```bash
./buddy deploy
./buddy cloud --ssh
```

Remove `infrastructure.jumpBox` and deploy again after the maintenance session to reduce cost and attack surface. `./buddy cloud:add --jump-box` and `./buddy cloud:remove --jump-box` report whether the deployed stack has one.

Restrict inbound access with `allowedCidrs` and use short-lived credentials.
