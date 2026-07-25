---
name: stacks-calendar
description: Use when working with calendar functionality in Stacks — exporting events to Google Calendar, Outlook, Yahoo, or ICS format, the CalendarLink interface for event definitions, timezone handling, all-day events, or calendar URL generation. Covers @stacksjs/calendar-api.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Calendar

Calendar event export to 4 calendar providers.

## Key Paths
- Core package: `storage/framework/core/calendar/src/`
- Package: `@stacksjs/calendar-api`

## Export Functions

```typescript
import { exportCalendarGoogle, exportCalendarIcs, exportCalendarOutlook, exportCalendarYahoo } from '@stacksjs/calendar-api'

const event: CalendarLink = {
  title: 'Team Meeting',
  description: 'Weekly standup',
  from: new Date('2024-06-15T10:00:00'),
  to: new Date('2024-06-15T11:00:00'),
  address: '123 Main St, City',
  timezone: 'America/New_York',
  allDay: false
}

// Generate URLs
const googleUrl = exportCalendarGoogle(event)
// → https://calendar.google.com/calendar/render?action=TEMPLATE&text=...

const icsContent = exportCalendarIcs(event)
// → BEGIN:VCALENDAR\nBEGIN:VEVENT\n...

const outlookUrl = exportCalendarOutlook(event)
// → https://outlook.live.com/calendar/0/deeplink/compose?...

const yahooUrl = exportCalendarYahoo(event)
// → https://calendar.yahoo.com/?v=60&title=...
```

## CalendarLink Interface

```typescript
interface CalendarLink {
  title: string
  description?: string
  from: Date              // start time
  to: Date                // end time
  allDay?: boolean        // all-day event (ignores time)
  address?: string        // location
  timezone?: string       // IANA timezone (e.g., 'America/New_York')
}
```

## Calendar Store Types

```typescript
interface CalendarStore {
  day: number
  month: number
  year: number
  currentMonthYear: string
  datesOfMonth: number[]
  currentWeekView: WeekDates[]
}

interface Events {
  date: string
  title: string
  description?: string
  month: number
  day: number
  year: number
  time?: Time
}

interface Time { from: string, to: string }
interface WeekDates { month: number, date: number }
```

## All-Day Events

```typescript
const allDayEvent: CalendarLink = {
  title: 'Company Holiday',
  from: new Date('2024-12-25'),
  to: new Date('2024-12-25'),
  allDay: true  // only date matters, no time component
}
```

## Format Differences

| Feature | Google | ICS | Outlook | Yahoo |
|---------|--------|-----|---------|-------|
| URL-based | Yes | No (file) | Yes | Yes |
| Timezone | URL param | VTIMEZONE | URL param | URL param |
| All-day | Date only | DATE value | isAllDay=true | st= format |
| Description | details= | DESCRIPTION | body= | desc= |

## Gotchas
- Note package name is `@stacksjs/calendar-api` (not `@stacksjs/calendar`)
- ICS export returns file content (not a URL) — serve as `.ics` download
- All-day events use date-only format, ignoring time components
- Timezone handling varies by provider — ICS includes VTIMEZONE block
- Google Calendar uses UTC format in URLs
- For task scheduling (cron), use `@stacksjs/scheduler` instead
- ICS generates a unique UID per event for calendar deduplication
