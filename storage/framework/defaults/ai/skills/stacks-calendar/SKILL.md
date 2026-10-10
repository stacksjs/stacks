---
name: stacks-calendar
description: Use when exporting calendar links or ICS bodies, building subscribable event feeds, or expanding supported recurrence rules. Covers @stacksjs/calendar-api.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Calendar

Use `@stacksjs/calendar-api` for add-to-calendar links, downloadable ICS,
subscribable feeds and the supported server-side recurrence subset. A calendar
export is different from a scheduler task or a provider calendar CRUD API.

## Single-event links and files

~~~ts
import { exportCalendarGoogle, exportCalendarIcs, exportCalendarIcsBody } from '@stacksjs/calendar-api'

const event = {
  title: 'Team meeting',
  description: 'Weekly standup',
  from: new Date('2026-10-12T17:00:00Z'),
  to: new Date('2026-10-12T18:00:00Z'),
  timezone: 'America/New_York',
  allDay: false,
}
const googleUrl = exportCalendarGoogle(event)
const downloadUrl = exportCalendarIcs(event)
const fileBody = exportCalendarIcsBody(event)
~~~

Google/Outlook/Yahoo exports return provider compose URLs. exportCalendarIcs
returns a base64 data URL for an anchor; exportCalendarIcsBody returns raw
text/calendar for a route or mail attachment. Do not serve the data URL string
as if it were an ICS file. The single-event CalendarLink source type has from/to,
title, required allDay and optional description/address/timezone; the root entry
does not re-export that type. Infer a literal or read src/types.ts when extending
the package.

The older single-event generator has its own timezone/time-format rules and
does not emit a VTIMEZONE block. Its UID derives from event timing/title, so
editing those changes the UID. Do not promise subscription update semantics
from a generated single-event link. Prefer the feed builder for stable records,
escaping and folded lines.

## Native subscribable feeds

buildCalendarFeed({ name, events, timezone?, refreshInterval?, prodId? }) returns
a complete VCALENDAR body. Use calendarFeedHeaders for the response and an
authorized route for private calendars. CalendarFeedEvent has a stable uid,
title/start/end plus optional allDay/description/location/url/rrule/sequence/
updatedAt. Keep uid stable, increment sequence and update updatedAt on edits.

The builder escapes ICS text and folds UTF-8 lines. Times are UTC; timezone is
advisory calendar metadata. All-day feed end dates are inclusive input, converted
to exclusive DTEND. Individual client refresh cadence is outside the framework's
control, even when the feed declares a suggested interval.

## Recurrence

parseRRule(value) returns RecurrenceRule or null for unsupported frequency.
expandRecurrence(rule, dtstart, windowStart, windowEnd) returns matching UTC
start instants, capped defensively. Supported fields include DAILY/WEEKLY/
MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYDAY and BYMONTHDAY. This is a subset;
unknown fields are not a proof of full RFC conformance. Callers own timezone
interpretation and DST policy. Calendar clients can expand a feed's raw rrule
independently from the server subset.

## Sources and evidence

`storage/framework/core/calendar-api/src/index.ts`, types.ts, feed.ts,
recurrence.ts and generators/ own the contracts. Retained tests:
core/calendar-api/tests/calendar.test.ts and feed-recurrence.test.ts.
For scheduled application work use stacks-scheduler; for a calendar extension's
models/dashboard use its installed package metadata, not a fictional calendar
API in this small export package.
