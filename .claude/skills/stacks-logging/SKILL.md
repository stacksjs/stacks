---
name: stacks-logging
description: Use when implementing logging in Stacks — the log facade (info, error, warn, debug, success), dump/dd debugging, timing functions, file-based logging, or log configuration. Covers @stacksjs/logging and config/logging.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Logging

Uses @stacksjs/clarity Logger with file writing to `storage/logs/stacks.log`.

## Key Paths
- Core package: `storage/framework/core/logging/src/`
- Configuration: `config/logging.ts`
- Log model: `storage/framework/models/Log.ts`
- Log file: `storage/logs/stacks.log`

## Log Facade

```typescript
import { log } from '@stacksjs/logging'

await log.info('User created', { userId: 1 })
await log.success('Deployment complete')
await log.warn('Rate limit approaching', { remaining: 10 })
await log.warning('Alias for warn')
await log.error(new Error('Something failed'), { context: 'handler' })
await log.debug('Debug info', { query: 'SELECT ...' })
```

### Error with Exit
```typescript
await log.error(err, { shouldExit: true })  // logs and exits process
```

## Dump & Die

```typescript
import { dump, dd, echo } from '@stacksjs/logging'

await dump(variable1, variable2)    // inspect without stopping
await dd(variable1, variable2)      // inspect and exit (never returns)
await echo('simple output')
```

## Timing

```typescript
const done = log.time('database-query')
await performQuery()
await done()  // logs elapsed time
```

## Logger Instance

```typescript
import { logger } from '@stacksjs/logging'

const l = logger  // underlying clarity Logger instance
```

## config/logging.ts
```typescript
{
  logsPath: 'storage/logs',
  deploymentsPath: 'storage/logs/deployments'
}
```

## Gotchas
- All log methods are async — they write to both console and file
- Log file is at `storage/logs/stacks.log`
- `dd()` never returns — it exits the process after dumping
- `dump()` continues execution — use for non-destructive debugging
- The Log model enables database-backed log storage and querying
- Error logging can optionally exit the process with `shouldExit: true`
- Logging is a dependency of many other packages — it's available everywhere
