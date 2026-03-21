---
name: stacks-realtime
description: Use when implementing real-time features in a Stacks application — WebSockets, broadcasting, live updates, or real-time event streaming. Covers @stacksjs/realtime and config/realtime.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Realtime

The `@stacksjs/realtime` package provides real-time integration for Stacks applications via `ts-broadcasting`.

## Key Paths
- Core package: `storage/framework/core/realtime/src/`
- Configuration: `config/realtime.ts`
- Websocket model: `storage/framework/models/Websocket.ts`
- Default realtime functions: `storage/framework/defaults/functions/realtime/`
- Default realtime models: `storage/framework/defaults/models/realtime/`
- Application broadcasts: `app/Broadcasts/` (in defaults)
- Package: `@stacksjs/realtime`

## Features
- WebSocket connections
- Event broadcasting
- Channel-based messaging
- Presence channels
- Real-time data synchronization

## Architecture
- Uses `ts-broadcasting` for WebSocket management
- Broadcasts are defined in application code
- Channels can be public, private, or presence
- WebSocket model tracks active connections

## Usage
```typescript
import { broadcast } from '@stacksjs/realtime'
```

## Gotchas
- Realtime requires WebSocket server configuration
- Configuration is in `config/realtime.ts`
- Works with `@stacksjs/chat` for real-time messaging
- The Websocket model tracks connection state
- Broadcasting integrates with the event system
