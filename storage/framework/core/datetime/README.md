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

To view the full documentation, please visit [https://stacksjs.com/datetime](https://stacksjs.com/datetime).

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

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## Credits

Many thanks to the following core technologies & people who have contributed to this package:

- [Carbon](https://carbon.nesbot.com)
- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
