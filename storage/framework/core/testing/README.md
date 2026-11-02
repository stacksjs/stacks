# Stacks Testing

wip

## Owned test services


Import `startTestService` and `notifyTestServiceReady` from
`@stacksjs/testing/service` in CLI scripts, without loading the test runner or
database. The child calls `notifyTestServiceReady(info)` only after its own
application checks succeed. Listening on a port is insufficient. The function
returns false when the script was started manually without IPC.

The parent awaits `service.ready`, then combines `service.signal` with its
command deadline using `AbortSignal.any`. Unexpected child exit aborts that
signal and rejects readiness if still pending. `service.exited` reports its
status. Always await `service.stop()` in finally: cleanup is idempotent and
terminates only the owned child, escalating SIGTERM to SIGKILL after
`stopGraceMs` (default 2 seconds). The service script owns its descendants.
Readiness has a separate `startupTimeoutMs` (default 60 seconds).

## ☘️ Features

wip

- ⚡️

wip

## 🤖 Usage

wip

```bash
bun install -d @stacksjs/testing
```

Now, you can use it in your project:

```js
import { tests } from '@stacksjs/testing'

// wip
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

[Join the Stacks Discord Server](https://stacksjs.com/discord)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
