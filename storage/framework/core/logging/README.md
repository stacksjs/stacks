# Stacks Logging

The Stacks logging system.

## ☘️ Features

- Logging tooling

## 🤖 Usage

```bash
bun install -d @stacksjs/logging
```

Now, you can use it in your project:

```js
import { dd, dump, log } from '@stacksjs/logging'

log('some log message')
log.debug('some debug message')
log.info('some info message')
log.warn('some warning message')
log.error('some error message')
log.success('some success message')

dump('some dump message')
dd('some dd message')
echo('some echo message')

// and more...
```

Learn more in the docs.

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

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
