# Stacks Events

Functional event emitting.

## ☘️ Features

- Functional event emitting

## 🤖 Usage

```bash
pnpm i -D @stacksjs/events
```

Now, you can use it in your project:

```js
import { dispatch, listen, all, off } from '@stacksjs/events'

// listen to an event
listen('foo', e => console.log('foo', e) )

// listen to all events
listen('*', (type, e) => console.log(type, e) )

// fire an event
dispatch('foo', { a: 'b' })

// clearing all events
all.clear()

// working with handler references:
function onFoo() {}
listen('foo', onFoo) // listen
off('foo', onFoo) // unlisten
```

For improved type inference, ensure to configure `./config/events.ts`. To view the full documentation, please visit [https://stacksjs.dev/events](https://stacksjs.dev/events).

## 🧪 Testing

```bash
pnpm test
```

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## 💪🏼 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.ow3.org)

## 🙏🏼 Credits

Many thanks to the following core technologies & people who have contributed to this package:

- [mitt](https://github.com/developit/mitt)
- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with ❤️
