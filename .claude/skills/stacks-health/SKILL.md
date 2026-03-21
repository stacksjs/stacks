---
name: stacks-health
description: Use when implementing health checks in a Stacks application — service health monitoring, health endpoints, or diagnostic checks. Covers the @stacksjs/health package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Health

The `@stacksjs/health` package provides health check services for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/health/src/`
- Package: `@stacksjs/health`

## Features
- Service health monitoring
- Health check endpoints
- Database connectivity checks
- External service status verification

## CLI Commands
- `buddy doctor` - Diagnose system issues

## Usage
```typescript
import { healthCheck } from '@stacksjs/health'
```

## Gotchas
- Health checks should be lightweight and fast
- Use `buddy doctor` for comprehensive system diagnostics
- Health endpoints should not expose sensitive information
- Integrate with monitoring systems for production alerts
