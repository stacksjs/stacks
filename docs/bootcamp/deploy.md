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

See [Cloud deployment](/guide/cloud/deployment) for first-deploy requirements and rollback guidance.
