# Stacks Datetime

Easily work with dates. Zero external dependencies, Carbon-inspired API.

## Features

- Carbon-inspired `DateTime` class with fluent chainable API
- Display & visualize dates in a human-friendly way
- Easily convert dates to different formats & timezones
- Simply calculate the difference between 2 dates
- Modify dates with ease (immutable operations)
- Zero external dependencies

## Usage

```bash
bun install -d @stacksjs/datetime
```

Now, you can easily access it in your project:

```js
import { DateTime, now } from '@stacksjs/datetime'

// Laravel-inspired now() helper
now().toDateString()         // '2024-03-15'
now().format('MMMM D, YYYY') // 'March 15, 2024'
now().addDays(7).toDateString()
now().startOfMonth().toDateString()

// DateTime class
const dt = DateTime.create(2024, 3, 15, 10, 30, 0)
dt.format('YYYY-MM-DD HH:mm:ss') // '2024-03-15 10:30:00'
dt.addHours(3).toTimeString()     // '13:30:00'
dt.isFuture()                     // depends on current time
dt.diffInDays(DateTime.now())     // days between dates

// Parse dates
DateTime.parse('2024-03-15', 'YYYY-MM-DD')
DateTime.parse('March 15, 2024', 'MMMM D, YYYY')

// Standalone format/parse functions
import { format, parse } from '@stacksjs/datetime'
format(new Date(), 'YYYY-MM-DD HH:mm:ss')
format(new Date(), 'MMMM D, YYYY', { tz: 'Asia/Tokyo' })
parse('2024-03-15 10:30:00', 'YYYY-MM-DD HH:mm:ss')
```

To view the full documentation, please visit [<https://stacksjs.com/datetim>e](https://stacksjs.com/datetime).

## Testing

```bash
bun test
```

## Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://stacksjs.com/discord)

## Credits

Many thanks to the following core technologies & people who have contributed to this package:

- [Carbon](https://carbon.nesbot.com)
- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙

## Site and organization clocks

`localDateTime(instant, ...timeZones)` resolves the first valid named zone, then
UTC, and returns `{ date, time, timeZone }` from one instant. Supply site and
organization zones in that order. Missing/invalid zones fall through; an
invalid instant throws. The output uses YYYY-MM-DD and HH:mm and is suitable
for comparing local schedule dates and end times, not for elapsed durations.

## Recurrences, coverage and local reporting periods

The pure schedule entry exports parseWeeklySchedule, expandWeeklySchedule,
clockMinutes, addClockMinutes and timeWindowsCover. Recurrence validation
rejects invalid weekday entries; expansion refuses excessive ranges and
midnight-crossing durations instead of silently truncating them. Adjacent
windows can cover one continuous slot. ScheduleInputError carries status 422.

localDateRange(from, to, ...zones) converts inclusive calendar days to an
exclusive-end UTC instant range in a selected valid zone, including DST days.
Its supported reporting dates are 0101-01-01 through 9999-12-30; unsupported
boundaries raise ScheduleInputError rather than normalizing to another year.
netHoursBetween(start, end, breaks) retains full precision; apply display or
monetary rounding at the final boundary. It performs duration arithmetic,
not jurisdiction-specific compensation or overtime decisions.

localTimeSpan(date, start, end, ...zones) converts a clock interval, including
next-day ends, to actual instants for cross-site/overnight overlap checks.
Equal endpoints and non-positive DST-normalized intervals are rejected.
