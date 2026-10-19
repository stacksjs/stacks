---
title: DateTime Package
description: "Dates and times in Stacks: the DateTime class, wall-clock times in a named zone across DST, YYYY-MM-DD calendar dates, and reading DATE columns without shifting a day."
---
# DateTime Package

`@stacksjs/datetime` has a Carbon-style `DateTime` class, `format()` and `parse()`,
and two smaller toolkits that most date bugs come down to: turning a wall-clock
time in a named zone into a real instant, and doing arithmetic on calendar dates
held as `YYYY-MM-DD` strings. It has no dependencies; time zone rules come from
the runtime's `Intl` data.

```ts
import { addDays, DateTime, minutesUntil, todayIn, zonedTimeToUtc } from '@stacksjs/datetime'
```

The `DateTime` class, its format tokens and `parse()` are documented in the
[`stacks-datetime` skill](/skills/utilities/datetime).

## Wall-clock times in a named zone

A class at 18:00 in Berlin, a show at 20:00 in New York: the time is what the
clocks there will read, not an instant. `zonedTimeToUtc` finds the instant;
`isoInZone` prints an instant with the zone's offset (the form schema.org's
`startDate` wants); `zoneOffsetMinutes` is the offset itself.

```ts
import { isoInZone, zonedTimeToUtc, zoneOffsetMinutes } from '@stacksjs/datetime'

const start = zonedTimeToUtc('2026-10-01T20:00:00', 'America/New_York')
start.toISOString()                       // '2026-10-02T00:00:00.000Z'
isoInZone(start, 'America/New_York')      // '2026-10-01T20:00:00-04:00'
zoneOffsetMinutes(start, 'Asia/Kolkata')  // 330
```

`wallClock` is `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss`. A
string with its own offset (`Z`, `-04:00`) is already an instant and throws a
`TypeError`.

### Daylight saving time

Twice a year a zone's clocks repeat an hour or skip one. `zonedTimeToUtc` treats
both the same way in every zone, following RFC 5545 and Temporal's
`'compatible'` rule:

| Wall clock | Zone | Instant | Rule |
| --- | --- | --- | --- |
| `2026-10-25T02:30` | `Europe/Berlin` | `00:30Z` (`+02:00`) | Repeated: the earlier of the two |
| `2026-11-01T01:30` | `America/New_York` | `05:30Z` (`-04:00`) | Repeated: the earlier of the two |
| `2026-03-29T02:30` | `Europe/Berlin` | `01:30Z`, shown as `03:30+02:00` | Skipped: read with the offset before the gap |
| `2026-03-08T02:30` | `America/New_York` | `07:30Z`, shown as `03:30-04:00` | Skipped: read with the offset before the gap |

Releases up to 0.75.228 returned the later instant of a repeated hour in zones
at or east of UTC (Berlin, London, Sydney) and the earlier one in New York.

## Calendar dates

A date column, a training day or a billing period is a day on a calendar. Keep
it a `YYYY-MM-DD` string. These helpers do their arithmetic on the UTC calendar,
where every day is 24 hours long whatever zone the server runs in, and meet a
time zone only where a real clock is involved.

| Function | Returns |
| --- | --- |
| `isCalendarDate(value)` | `true` for a real `YYYY-MM-DD` date (`2026-02-31` and `2026-2-3` are not); a type guard |
| `isTimeZone(value)` | `true` for an IANA zone the runtime knows; a type guard |
| `todayIn(timeZone, now?)` | Today's date in that zone |
| `addDays(ymd, days)` | The date `days` later (negative goes back) |
| `daysBetween(from, to)` | Whole days from `from` to `to`, signed |
| `startOfIsoWeek(ymd)` | The Monday that starts the ISO week containing `ymd` |
| `minutesUntil(date, time, timeZone, now?)` | Real minutes from `now` until clocks in `timeZone` read `time` on `date` |
| `addCalendarMonths(date, months, { utc? })` | A `Date` moved by calendar months, the day clamped to the month's end |

```ts
import { addDays, daysBetween, isCalendarDate, minutesUntil, startOfIsoWeek, todayIn } from '@stacksjs/datetime'

const today = todayIn(gym.timezone)          // the gym's date, not the server's
const ends = addDays(today, 30)
daysBetween(today, ends)                     // 30
startOfIsoWeek('2026-10-18')                 // '2026-10-12', a Sunday belongs to the week before

if (!isCalendarDate(body.date))
  return response.json({ error: 'Use a YYYY-MM-DD date' }, 422)

// Remind an hour before a class, in the gym's time, correct on the night the clocks change:
const minutes = minutesUntil(session.date, session.start_time, gym.timezone)
if (minutes > 0 && minutes <= 60) await remind(session)
```

`minutesUntil` subtracts real instants. On the night Berlin's clocks go back,
midnight to 09:00 is ten hours, and it says 600; subtracting the two wall-clock
readings says 540. The result keeps the seconds of `now` as a fraction.

Each helper throws a `RangeError` for an impossible date, a malformed time
(`HH:mm` or `HH:mm:ss`), an unknown zone or an invalid instant, so check
untrusted input with `isCalendarDate` and `isTimeZone` first. `todayIn` takes one
zone; to fall back from a site's zone to its organization's to UTC, use
`localDateTime(now, site.timezone, organization.timezone).date`.

## Reading DATE columns

Database drivers return a `DATE` column as a JS `Date`, and not all at the same
midnight: Bun's Postgres driver builds UTC midnight, others the host's local
midnight. `date.toISOString().slice(0, 10)` is right only for the first; on a
host east of UTC it moves a local-midnight date to the day before.
`parseSqlDate` from `@stacksjs/database` reads either correctly:

```ts
import { parseSqlDate } from '@stacksjs/database'

parseSqlDate(row.starts_on)            // '2026-10-18', whichever midnight the driver chose
parseSqlDate('2026-10-18 00:00:00')    // '2026-10-18'
parseSqlDate('2026-02-31')             // null
```

A local-midnight `Date` is read from its local fields and any other `Date` from
its UTC fields; strings keep their date part. Missing, invalid and impossible
values return null, so a caller fails closed instead of inventing a day.
