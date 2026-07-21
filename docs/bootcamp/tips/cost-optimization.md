---
title: Cost Optimization
description: Review cloud changes and remove temporary infrastructure that is no longer needed.
---
# Cost Optimization

Preview cost-related infrastructure changes before applying them:

```bash
./buddy cloud --diff
./buddy cloud:optimize-cost
```

The current optimizer can remove a temporary jump box. Continue to review service dashboards, storage retention, log volume, and traffic before changing capacity. Cost optimization must not weaken backups, availability, or security controls.
