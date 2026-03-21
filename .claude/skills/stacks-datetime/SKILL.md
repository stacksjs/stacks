---
name: stacks-datetime
description: Use when working with dates and times in a Stacks application — parsing, formatting, comparing, or manipulating date/time values. Covers the @stacksjs/datetime package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks DateTime

The `@stacksjs/datetime` package provides date and time utilities for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/datetime/src/`
- Package: `@stacksjs/datetime`

## Features
- Date parsing and formatting
- Date comparison and manipulation
- Timezone handling
- Duration calculations
- Relative time formatting

## Usage
```typescript
import { now, parse, format, diff } from '@stacksjs/datetime'
```

## Integration
- Used by `@stacksjs/calendar-api` for calendar date handling
- Used by `@stacksjs/scheduler` for scheduled task timing
- Timezone defaults configured in `config/app.ts`

## Gotchas
- Application timezone is set in `config/app.ts`
- DateTime utilities are lightweight wrappers for consistency
- Prefer `@stacksjs/datetime` over raw `Date` objects for framework consistency
