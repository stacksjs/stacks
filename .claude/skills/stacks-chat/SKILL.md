---
name: stacks-chat
description: Use when implementing chat functionality in a Stacks application — real-time messaging, chat rooms, or chat API integration. Covers the @stacksjs/chat package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Chat

The `@stacksjs/chat` package provides chat API integration for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/chat/src/`
- Package: `@stacksjs/chat`

## Features
- Chat messaging API
- Real-time message delivery
- Chat room management
- Integration with the Stacks realtime system

## Usage
```typescript
import { chat } from '@stacksjs/chat'
```

## Integration
- Works with `@stacksjs/realtime` for WebSocket-based real-time delivery
- Can be combined with `@stacksjs/notifications` for chat notifications
- Uses `@stacksjs/auth` for user authentication in chat contexts

## Gotchas
- Real-time features require the realtime package to be configured
- Chat state management may need database backing via `@stacksjs/database`
- Configure WebSocket settings in `config/realtime.ts`
