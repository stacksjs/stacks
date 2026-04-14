# Stacks Events

Functional event emitting.

## ☘️ Features

- Functional event emitting

## 🤖 Usage

```bash
bun install -d @stacksjs/events
```

Now, you can use it in your project:

```js
import { all, dispatch, listen, off } from '@stacksjs/events'

// listen to an event
listen('foo', e => console.log('foo', e))

// listen to all events
listen('*', (type, e) => console.log(type, e))

// fire an event
dispatch('foo', { a: 'b' })

// clearing all events
all.clear()

// working with handler references:
function onFoo() {}
listen('foo', onFoo) // listen
off('foo', onFoo) // unlisten
```

To view the full documentation, please visit [<https://stacksjs.com/event>s](https://stacksjs.com/events).

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

- [mitt](https://github.com/developit/mitt)
- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
