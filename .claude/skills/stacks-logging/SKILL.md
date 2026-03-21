---
name: stacks-logging
description: Use when implementing logging in a Stacks application — configuring log levels, log outputs, structured logging, or debugging with logs. Covers @stacksjs/logging and config/logging.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Logging

The `@stacksjs/logging` package provides a logging system for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/logging/src/`
- Configuration: `config/logging.ts`
- Log model: `storage/framework/models/Log.ts`
- External tool: ~/Code/Tools/logsmith/
- Package: `@stacksjs/logging`

## Features
- Structured logging
- Multiple log levels (debug, info, warn, error)
- Log output configuration (console, file, database)
- Request logging integration

## Configuration
Edit `config/logging.ts` for:
- Log level thresholds
- Output destinations
- Log formatting
- Log retention

## Log Model
The `Log` model at `storage/framework/models/Log.ts` enables database-backed log storage.

## Usage
```typescript
import { log } from '@stacksjs/logging'

log.info('Operation completed')
log.error('Something failed', { context })
```

## Gotchas
- Logging is a dependency of many other packages
- Use structured logging (objects, not string concatenation)
- Log model enables querying historical logs
- The underlying tool is logsmith from ~/Code/Tools/logsmith/
- Configure log rotation to prevent storage issues
