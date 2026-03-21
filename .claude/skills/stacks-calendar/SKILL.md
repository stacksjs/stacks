---
name: stacks-calendar
description: Use when working with calendar functionality in a Stacks application — calendar events, scheduling, or CalDAV integration. Covers the @stacksjs/calendar-api package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Calendar

The `@stacksjs/calendar-api` package provides calendar API integration for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/calendar/src/`
- Package: `@stacksjs/calendar-api`

## Features
- Calendar event management
- CalDAV protocol support
- Event scheduling and recurring events
- Integration with the Stacks datetime package

## Usage
```typescript
import { calendar } from '@stacksjs/calendar-api'
```

## Gotchas
- Note the package name is `@stacksjs/calendar-api` (not `@stacksjs/calendar`)
- Calendar integrates with `@stacksjs/datetime` for date handling
- For task scheduling (cron-like), use `@stacksjs/scheduler` instead
