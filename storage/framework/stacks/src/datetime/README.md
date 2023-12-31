# Stacks Datetime

Easily work with dates.

## ☘️ Features

- Display & visualize dates in a human-friendly way
- Easily convert dates to different formats & timezones
- Simply calculate the difference between 2 dates
- Modify dates with ease

## 🤖 Usage

```bash
bun install -d @stacksjs/datetime
```

Now, you can easily access it in your project:

```js
import { now, useDateFormat } from '@stacksjs/datetime'

const formatted = useDateFormat(now(), 'YYYY-MM-DD HH:mm:ss')
console.log(formatted) // 2022-11-01 17:06:01
```

To view the full documentation, please visit [https://stacksjs.org/datetime](https://stacksjs.org/datetime).

## 🧪 Testing

```bash
bun test
```

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## 🙏🏼 Credits

Many thanks to the following core technologies & people who have contributed to this package:

- [VueUse](https://vueuse.org)
- [Carbon](https://carbon.nesbot.com)
- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
