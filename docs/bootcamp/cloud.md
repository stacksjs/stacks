---
title: Extending the Cloud
description: Add application-specific AWS resources to the typed Stacks cloud deployment.
---
# Extending the Cloud

Stacks keeps its cloud infrastructure in `cloud/`. Add application-specific constructs there and read deployment values from typed configuration rather than hard-coding account, region, or domain values.

Preview every infrastructure change before deployment:

```bash
./buddy cloud --diff
./buddy deploy
```

Keep custom resources in the application layer so framework updates remain reproducible. See [Extending cloud infrastructure](/guide/cloud/extend) for the project structure and [Cloud deployment](/guide/cloud/deployment) for the release flow.
