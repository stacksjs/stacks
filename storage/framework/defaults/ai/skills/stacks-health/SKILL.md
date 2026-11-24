---
name: stacks-health
description: Use when implementing health checks in a Stacks application - service monitoring, health endpoints, or diagnostic checks. Covers @stacksjs/health (currently WIP - Oh Dear integration planned).
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Health

## Key Paths
- Core package: `storage/framework/core/health/src/`
- Drivers: `storage/framework/core/health/src/drivers/`
- Notifications: `storage/framework/core/health/src/notifications/`
- Package: `@stacksjs/health`

## Source Files
```
health/src/
├── index.ts              # Re-exports drivers and notifications
├── drivers/
│   ├── index.ts          # Driver exports
│   └── ohdear.ts         # Oh Dear health check driver (WIP)
└── notifications/
    └── index.ts          # Health notifications (WIP)
```

## Current Status

**This package is WIP.** Current exports are placeholder markers:

```typescript
export const ohdearWip = 1              // Oh Dear driver placeholder
export const healthNotificationsWip = 1  // Notifications placeholder
```

## Built-in Health Endpoint

The health check functionality currently lives in the router, not this package:

```
GET /api/health
```

It is mounted under `/api`, not at `/health`, so it cannot collide with a page
of the app's own. Point load balancers, uptime monitors and a deploy's
`healthCheck` at `/api/health`.

It runs a database check (`SELECT 1`) and a cache round trip, each with a
1.5 second timeout, and answers 200 when both pass and 503 when one fails:

```json
{
  "status": "healthy",
  "checks": {
    "database": { "ok": true, "ms": 2 },
    "cache": { "ok": true, "ms": 1 }
  },
  "timestamp": 1764000000000
}
```

A failing check has `ok: false` and a `message`, and `status` is `"degraded"`.

This endpoint is registered via `route.health()` in the router
(`checkApplicationHealth()` in `core/router/src/health.ts`).

## CLI Commands

```bash
buddy doctor              # Comprehensive system diagnostics
```

## Planned Features
- Oh Dear integration for external health monitoring
- Health check notifications (email, Slack, etc.)
- Custom health check drivers
- Database connectivity checks
- External service status verification

## Gotchas
- **Package is WIP** — only placeholder exports exist
- **Health endpoint is in the router**: `GET /api/health` (not `/health`) works via `route.health()`, not this package
- **`buddy doctor`** — system diagnostics are in the buddy CLI, not this health package
- **Oh Dear driver planned** — integration with ohdear.app for external monitoring
