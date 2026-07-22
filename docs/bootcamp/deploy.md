---
title: How to deploy
description: Validate and deploy a Stacks application and its cloud infrastructure.
---
# How to deploy

Start with the health check and a production build. Preview infrastructure changes before applying them.

```bash
./buddy doctor
./buddy build
./buddy cloud --diff
./buddy deploy
```

The deploy command verifies environment settings, application keys, AWS access, DNS, and mail prerequisites before updating the stack. CDN invalidation is part of the deployment flow when the configured resources require it.

## Production push-to-deploy

GitHub Actions maps `main` to the protected `production` environment and runs
`./buddy deploy --prod --yes` only after lint, typecheck, tests, protocol
evidence, and generated documentation checks pass. Buddy owns the deployment
boundary and delegates infrastructure generation and application to ts-cloud;
the workflow does not reproduce cloud provider commands.

Production is currently the only provisioned target. The checked-in resolver
rejects `stage`, `dev`, tags, and unknown refs instead of guessing credentials
or environments. Issue [#2068](https://github.com/stacksjs/stacks/issues/2068)
tracks provisioning and testing those future targets before their branch
mappings can be restored.

See [Cloud deployment](/guide/cloud/deployment) for first-deploy requirements and rollback guidance.
