---
name: stacks-cloud
description: Use when deploying or managing cloud infrastructure for a Stacks application — AWS integration, serverless deployment, CDK configuration, or cloud resource management. Covers @stacksjs/cloud, @stacksjs/deploy, config/cloud.ts, and the cloud/ directory.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, AWS
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Cloud & Deployment

The `@stacksjs/cloud` and `@stacksjs/deploy` packages provide cloud/serverless integration for Stacks applications, primarily targeting AWS via `@stacksjs/ts-cloud`.

## Key Paths
- Cloud package: `storage/framework/core/cloud/src/`
- Deploy package: `storage/framework/core/deploy/src/`
- Cloud infrastructure: `storage/framework/cloud/`
- Cloud config directory: `cloud/`
- Configuration: `config/cloud.ts`
- TS Cloud config: `.ts-cloud/`
- Packages: `@stacksjs/cloud`, `@stacksjs/deploy`

## Architecture
- Uses `@stacksjs/ts-cloud` for infrastructure-as-code (CDK-based)
- Cloud resources defined in `cloud/` and `.ts-cloud/` directories
- Deployment is managed through the `buddy deploy` command
- AWS is the primary cloud provider

## Deployment Commands
- `buddy deploy` - Deploy the application
- `buddy cloud` - Cloud management commands

## Configuration
Edit `config/cloud.ts` for cloud provider settings, regions, and resource configurations.

## Gotchas
- Cloud deployment requires AWS credentials configured
- The `.ts-cloud/` directory contains TypeScript CDK integration
- `storage/framework/cloud/` contains the CDK stack definitions
- Always test deployments in a staging environment first
- Deploy depends on the build system completing successfully
