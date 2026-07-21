---
title: How to publish
description: Build, verify, version, and publish a Stacks library through its release workflow.
---
# How to publish

Configure the package names and exported files in `config/library.ts`, then build and test every distributable target.

```bash
./buddy build:components
./buddy build:functions
./buddy test
./buddy lint
```

Preview the release before creating a tag:

```bash
./buddy release --dry-run
```

When the package is ready, `./buddy release` versions the configured packages and triggers the repository release workflow. npm publishing should use a trusted publisher with GitHub Actions OIDC, so a long-lived npm token is not required.

See [Publishing libraries](/guide/libraries/publish) for package metadata and workflow details.
