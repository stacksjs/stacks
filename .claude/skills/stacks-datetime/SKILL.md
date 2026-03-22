---
name: stacks-datetime
description: Use when working with dates and times in Stacks — the DateTime class with Carbon-like API (add/sub, comparison, formatting, start/end of day/month/year), date parsing, format tokens, or timezone handling. Covers @stacksjs/datetime.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks DateTime

Carbon-inspired DateTime class with immutable operations and zero external dependencies.

## Key Paths
- Core package: `storage/framework/core/datetime/src/`
- Package: `@stacksjs/datetime`

## Architecture

The `index.ts` exports:
```typescript
export { DateTime, now } from './now'
export { format } from './format'
export { parse } from './parse'
export { format as dateFormat } from './format'  // convenience alias
```

Three source files:
- `now.ts` — `DateTime` class and `now()` helper
- `format.ts` — standalone `format()` function with token-based formatting and timezone support
- `parse.ts` — standalone `parse()` function with token-based parsing

## DateTime Class (`now.ts`)

### Construction
```typescript
import { DateTime, now } from '@stacksjs/datetime'

const dt = new DateTime()                          // current time
const dt = new DateTime(new Date())                // from native Date (cloned)
const dt = new DateTime('2024-06-15')              // from date string
const dt = new DateTime('15/06/2024', 'DD/MM/YYYY') // from string with format

// Static factory methods
const dt = DateTime.now()                          // current time
const dt = DateTime.create(2024, 6, 15, 10, 30, 0) // year, month (1-12), day, hour, min, sec
const dt = DateTime.fromDate(new Date())           // from native Date
const dt = DateTime.parse('2024-06-15')            // from string
const dt = DateTime.parse('15/06/2024', 'DD/MM/YYYY') // from string with format
```

Note: `DateTime.create()` uses 1-based months (1=January), converting internally with `month - 1`.

### Getters (read-only properties)
```typescript
dt.year        // number -- full year (e.g. 2024)
dt.month       // number -- 1-12 (1-based, NOT zero-based like native Date)
dt.day         // number -- day of month (1-31)
dt.hour        // number -- 0-23
dt.minute      // number -- 0-59
dt.second      // number -- 0-59
dt.dayOfWeek   // number -- 0 (Sunday) through 6 (Saturday)
dt.timestamp   // number -- milliseconds since Unix epoch
```

### Formatting
```typescript
dt.format('YYYY-MM-DD HH:mm:ss')           // '2024-06-15 10:30:00'
dt.format('MMMM D, YYYY', 'en')            // 'June 15, 2024'
dt.format('HH:mm', { locale: 'de', tz: 'Europe/Berlin' })

dt.toDateString()                            // 'YYYY-MM-DD' format
dt.toTimeString()                            // 'HH:mm:ss' format
dt.toDateTimeString()                        // 'YYYY-MM-DD HH:mm:ss' format
dt.toISOString()                             // ISO 8601 (native Date.toISOString)
dt.toString()                                // same as toDateTimeString()
dt.toJSON()                                  // same as toISOString()
```

### Format Tokens

Used by both `DateTime.format()` and the standalone `format()` function:

| Token | Output | Description |
|-------|--------|-------------|
| YYYY | 2024 | 4-digit year |
| YY | 24 | 2-digit year |
| MMMM | January | Full month name (via Intl.DateTimeFormat) |
| MMM | Jan | Short month name (via Intl.DateTimeFormat) |
| MM | 01 | 2-digit month (01-12) |
| M | 1 | Month (1-12) |
| DD | 01 | 2-digit day (01-31) |
| D | 1 | Day (1-31) |
| dddd | Wednesday | Full weekday name (via Intl.DateTimeFormat) |
| ddd | Wed | Short weekday name (via Intl.DateTimeFormat) |
| d | W | Narrow weekday (via Intl.DateTimeFormat) |
| HH | 00 | 24-hour padded (00-23) |
| H | 0 | 24-hour (0-23) |
| hh | 12 | 12-hour padded (01-12) |
| h | 12 | 12-hour (1-12) |
| mm | 05 | Minutes padded (00-59) |
| m | 5 | Minutes (0-59) |
| ss | 09 | Seconds padded (00-59) |
| s | 9 | Seconds (0-59) |
| A | AM/PM | Uppercase AM/PM |
| a | am/pm | Lowercase am/pm |
| Z | +0530 | Timezone offset (no colon, e.g. +0800, -0500) |

Tokens are matched longest-first to avoid partial matching.

### Arithmetic (all return NEW DateTime instances -- immutable)
```typescript
dt.addSeconds(30)      dt.subSeconds(30)
dt.addMinutes(15)      dt.subMinutes(15)
dt.addHours(2)         dt.subHours(2)
dt.addDays(7)          dt.subDays(7)
dt.addWeeks(1)         dt.subWeeks(1)    // delegates to addDays(n * 7)
dt.addMonths(3)        dt.subMonths(3)
dt.addYears(1)         dt.subYears(1)
```

Implementation details:
- `addSeconds/Minutes/Hours` use millisecond arithmetic on timestamp
- `addDays` uses `Date.setDate()` (handles month boundaries correctly)
- `addMonths` uses `Date.setMonth()` (handles year boundaries)
- `addYears` uses `Date.setFullYear()`
- All `sub*` methods delegate to `add*(-n)`

### Period Boundaries (return NEW DateTime instances)
```typescript
dt.startOfDay()     // sets time to 00:00:00.000
dt.endOfDay()       // sets time to 23:59:59.999

dt.startOfMonth()   // sets to 1st of month, 00:00:00.000
dt.endOfMonth()     // sets to last day of month, 23:59:59.999
                    // uses new Date(year, month + 1, 0) trick for last day

dt.startOfYear()    // January 1, 00:00:00.000
dt.endOfYear()      // December 31, 23:59:59.999
```

### Setters (return NEW DateTime instances)
```typescript
dt.setYear(2025)     // new DateTime with year changed
dt.setMonth(6)       // 1-based month (internally does month - 1)
dt.setDay(15)        // uses Date.setDate()
dt.setHour(10)
dt.setMinute(30)
dt.setSecond(0)
```

### Comparison
```typescript
dt.isBefore(other)         // true if this < other (millisecond comparison)
dt.isAfter(other)          // true if this > other
dt.isSame(other)           // true if exact same millisecond
dt.isSameDay(other)        // true if same year, month, day (ignores time)
dt.isBetween(start, end)   // true if this > start AND this < end (exclusive)
dt.isPast()                // true if before Date.now()
dt.isFuture()              // true if after Date.now()
dt.isToday()               // true if same day as today (uses isSameDay)
dt.isLeapYear()            // true if year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
```

All comparison methods accept `DateTime | Date` as the `other` parameter.

### Difference
```typescript
dt.diffInSeconds(other)    // number -- Math.floor((this - other) / 1000)
dt.diffInMinutes(other)    // number -- Math.floor(diffInSeconds / 60)
dt.diffInHours(other)      // number -- Math.floor(diffInSeconds / 3600)
dt.diffInDays(other)       // number -- Math.floor(diffInSeconds / 86400)
```

Returns signed values: positive if `this` is after `other`, negative if before.

### Conversion
```typescript
dt.toNativeDate()          // new Date (cloned)
dt.valueOf()               // number (milliseconds since epoch)
dt.toJSON()                // ISO string (for JSON serialization)
```

## Standalone `format()` Function (`format.ts`)

```typescript
import { format } from '@stacksjs/datetime'

format(new Date(), 'YYYY-MM-DD')                    // '2024-06-15'
format('2024-06-15', 'MMMM D, YYYY')                // 'June 15, 2024'
format(new Date(), 'dddd, MMMM D, YYYY h:mm A')     // 'Saturday, June 15, 2024 10:30 AM'

// With locale
format(new Date(), 'dddd, MMMM D', 'de')            // 'Samstag, Juni 15'

// With timezone
format(new Date(), 'YYYY-MM-DD HH:mm Z', { tz: 'America/New_York' })
format(new Date(), 'HH:mm', { locale: 'en', tz: 'Asia/Tokyo' })
```

Signature: `format(inputDate: Date | string, formatStr?: string, localeOrOptions?: string | { locale?: string, tz?: string })`

Default format string: `'YYYY-MM-DD'`
Default locale: `'en'`

### Timezone Support
When a `tz` option is provided, the function uses `Intl.DateTimeFormat` with `timeZone` to extract date parts in the target timezone. The timezone offset (`Z` token) is computed by comparing UTC wall-clock time to the timezone's wall-clock time.

Without `tz`, uses local time via native Date getters (faster path, no Intl overhead for numeric parts). Named parts (month names, weekday names) always use Intl for locale support.

## Standalone `parse()` Function (`parse.ts`)

```typescript
import { parse } from '@stacksjs/datetime'

// Without format string -- native Date parsing with fix
parse('2024-06-15')                    // Date -- treated as LOCAL time (not UTC)
parse('2024-06-15T10:30:00Z')          // Date -- ISO string, native parsing

// With format string -- token-based extraction
parse('15/06/2024', 'DD/MM/YYYY')      // Date
parse('June 15, 2024', 'MMMM DD, YYYY') // Date
parse('2024-06-15 10:30:00', 'YYYY-MM-DD HH:mm:ss')  // Date
parse('03:30 PM', 'hh:mm A')          // Date with AM/PM handling
parse('2024-06-15 10:30 +0530', 'YYYY-MM-DD HH:mm Z') // Date with timezone offset
```

### Parse Behavior

**Without format string**:
- Date-only ISO strings (YYYY-MM-DD) are parsed as LOCAL time, not UTC -- this is a deliberate fix for the native Date behavior where `new Date('2024-06-15')` treats it as UTC causing day shifts
- All other strings use native `new Date()` parsing
- Throws on invalid dates

**With format string**:
- Builds a regex from the format tokens and extracts named groups
- Supports tokens: YYYY, YY, MMMM, MMM, MM, M, DD, D, HH, H, hh, h, mm, m, ss, s, A, a, Z
- YY: years 70-99 become 1900s, 00-69 become 2000s
- AM/PM: adjusts hours for 12-hour format (12 AM = 0, 12 PM = 12)
- Month names: handles full ("January") and short ("Jan") names, case-insensitive
- Z token: parses +HHMM offset, constructs UTC time and adjusts
- Throws if the format doesn't match the input string

## `now()` Helper

```typescript
import { now } from '@stacksjs/datetime'

now()                                  // DateTime.now()
now().toDateString()                   // '2024-06-15'
now().format('MMMM D, YYYY')          // 'June 15, 2024'
now().addDays(7).toDateString()        // one week from now
now().startOfMonth().toDateString()    // first of current month
```

## Gotchas
- All DateTime arithmetic operations return NEW instances -- the original is never mutated
- `DateTime.month` returns 1-12 (1-based), NOT 0-11 like native Date
- `DateTime.create(year, month)` takes 1-based month -- internally converts with `month - 1`
- `dayOfWeek` returns 0 (Sunday) through 6 (Saturday) -- matches native Date.getDay()
- `timestamp` returns MILLISECONDS since epoch, not seconds
- `diffIn*` methods return signed values -- positive when `this` is after `other`
- `isBetween(start, end)` is EXCLUSIVE on both ends (strictly between)
- `parse('2024-06-15')` without format is treated as LOCAL time (intentional deviation from spec)
- The `Z` timezone offset token format is `+HHMM` (no colon) -- e.g. `+0530`, `-0800`
- `format()` with `tz` option uses `Intl.DateTimeFormat` which requires valid IANA timezone names
- The `d` token in formatting returns the NARROW weekday (single letter like "W"), not a day number
- `endOfMonth()` uses the `new Date(year, month + 1, 0)` trick to find the last day
- Application timezone should be configured in `config/app.ts`
- Prefer `@stacksjs/datetime` over raw `Date` for framework consistency
