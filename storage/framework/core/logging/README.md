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

## LogHQ

Stacks includes a buffered LogHQ transport. Set the ingest key and the default
logging config registers it in production and staging:

```env
LOGHQ_KEY=loghq_your_project_key
```

`LOGHQ_BASE_URL` targets a self-hosted LogHQ instance. `LOGHQ_PROJECT` adds a
searchable project label to every entry and otherwise defaults to `APP_NAME`.
An empty key, or an environment outside the configured allowlist, creates no
transport, timer, queue, or request.

The transport buffers on the caller path and drains through `log.flush()`. Its
network failures are contained and reported only through the SDK's optional
console diagnostics, never back through `log`, so a delivery failure cannot
re-enter the transport.

For direct configuration, use the public adapter:

```ts
import { createLogHqTransport } from '@stacksjs/logging/loghq'

const transport = createLogHqTransport({
  key: process.env.LOGHQ_KEY,
  environment: 'production',
  level: 'debug',
})
```

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

[Join the Stacks Discord Server](https://stacksjs.com/discord)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
