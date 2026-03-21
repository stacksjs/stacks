---
name: stacks-deploy
description: Use when deploying a Stacks application — configuring deployment targets, running deployments, or managing deployment infrastructure. Covers the @stacksjs/deploy package and buddy deploy command.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, AWS
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Deployment

The `@stacksjs/deploy` package provides deployment automation for Stacks applications using `@stacksjs/ts-cloud`.

## Key Paths
- Core package: `storage/framework/core/deploy/src/`
- Cloud infrastructure: `storage/framework/cloud/`
- Cloud config: `cloud/`, `.ts-cloud/`
- Configuration: `config/cloud.ts`
- Package: `@stacksjs/deploy`

## Deployment Commands
- `buddy deploy` - Deploy the application
- `bun run deploy` - Alternative via npm script

## Architecture
- Deployment is powered by `@stacksjs/ts-cloud` (CDK-based)
- Cloud resources are defined as TypeScript infrastructure-as-code
- Supports AWS as the primary cloud provider
- Build artifacts are generated before deployment

## Deployment Flow
1. Build the application (`buddy build`)
2. Generate cloud infrastructure (`@stacksjs/ts-cloud`)
3. Deploy to target environment (`buddy deploy`)

## Gotchas
- Always build before deploying
- AWS credentials must be configured
- Deployment config is in `config/cloud.ts`
- The `.ts-cloud/` directory contains CDK-specific configuration
- Test deployments in staging before production
- See `@stacksjs/cloud` skill for cloud infrastructure details
