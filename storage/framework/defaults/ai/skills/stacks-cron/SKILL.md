---
name: stacks-cron
description: Use when working with cron expressions in a Stacks application — parsing cron syntax, registering OS-level cron jobs, or low-level scheduling. Covers @stacksjs/cron. For higher-level scheduling, see stacks-scheduler.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Cron

Low-level cron expression parser and OS-level job registration. For most scheduling tasks, use `@stacksjs/scheduler` instead.

## Key Paths
- Core package: `storage/framework/core/cron/src/`
- Package: `@stacksjs/cron`

## Source Files
```
cron/src/
├── index.ts              # Re-exports
├── parser.ts             # Cron expression parser (parseCron)
├── types.ts              # Type definitions
└── bun-cron.d.ts         # Bun.cron type declarations
```

## API

### parse

```typescript
import { parse } from '@stacksjs/cron'

function parse(expression: string, relativeDate?: Date | number): Date | null
```

Parses a cron expression and returns the next matching UTC date. Falls back to native `Bun.cron.parse()` if available.

```typescript
parse('0 0 * * *')                   // Next midnight UTC
parse('*/5 * * * *')                 // Next 5-minute mark
parse('0 9 * * MON-FRI')             // Next weekday at 9 AM
parse('0 0 1 * *', new Date())       // Next 1st of month from now
```

### parseCron (Native Implementation)

```typescript
import { parseCron } from '@stacksjs/cron'

function parseCron(expression: string, relativeDate?: Date | number): Date | null
```

Full 5-field cron parser supporting:

| Field | Values | Special Characters |
|-------|--------|--------------------|
| Minute | 0-59 | `*` `,` `-` `/` |
| Hour | 0-23 | `*` `,` `-` `/` |
| Day of Month | 1-31 | `*` `,` `-` `/` |
| Month | 1-12 or JAN-DEC | `*` `,` `-` `/` |
| Day of Week | 0-6 or SUN-SAT | `*` `,` `-` `/` |

### Nicknames

| Nickname | Equivalent |
|----------|-----------|
| `@yearly` / `@annually` | `0 0 1 1 *` |
| `@monthly` | `0 0 1 * *` |
| `@weekly` | `0 0 * * 0` |
| `@daily` / `@midnight` | `0 0 * * *` |
| `@hourly` | `0 * * * *` |

### register

```typescript
import { register } from '@stacksjs/cron'

async function register(path: string, schedule: string, title: string): Promise<void>
```

Registers an OS-level cron job. Requires Bun.cron support.

- `path` — path to the script (must export `scheduled(controller)` handler)
- `schedule` — cron expression
- `title` — job identifier (alphanumeric, hyphens, underscores only)

### remove

```typescript
import { remove } from '@stacksjs/cron'

async function remove(title: string): Promise<void>
```

Removes a registered cron job by title.

## Types

```typescript
type CatchCallbackFn = (error: Error) => void
type ProtectCallbackFn = () => void
type IntRange<Min, Max>  // TypeScript utility for bounded integer ranges
```

## Cron Expression Examples

```typescript
parse('*/5 * * * *')          // Every 5 minutes
parse('0 */2 * * *')          // Every 2 hours
parse('0 9,17 * * *')         // At 9 AM and 5 PM
parse('0 0 * * MON')          // Every Monday at midnight
parse('0 0 1,15 * *')         // 1st and 15th of each month
parse('30 4 * * SUN')         // Sundays at 4:30 AM
```

## Gotchas
- **Low-level primitive** — for most use cases, prefer `@stacksjs/scheduler` which provides `.daily()`, `.hourly()`, etc.
- **UTC dates** — `parse()` returns UTC dates, not local time
- **POSIX OR logic** — when both dayOfMonth and dayOfWeek are specified (not `*`), matches if EITHER matches
- **Named values** — supports JAN-DEC and SUN-SAT (case-insensitive)
- **Searches up to ~4 years** — parser iterates forward to find the next match, stops after ~4 years
- **OS-level registration** — `register()` requires Bun.cron support (not available in all environments)
- **`register()` scripts must export `scheduled()`** — the target file must have a `scheduled(controller)` handler
