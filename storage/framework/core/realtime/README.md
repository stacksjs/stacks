# Stacks Realtime

Native WebSocket broadcasting and authenticated HTTP event streams, with
opt-in process-local replay or explicit durable SQL replay.

```ts
import { emit, createBroadcastResponse } from '@stacksjs/realtime'

emit('orders.42', 'changed', { orderId: 42 }, { private: true })
```

Initialize the native broadcast server/hub before emitting. Stream consumers
supply current per-request authorization; a channel name is not authority.

For durable history, use `createSqlDurableReplayStore` with app-owned generated
tables and a transaction-bound SQL adapter. Await `append` before notifying.
`createDurableReplayResponse` checks authorization before and after replay.
Existing synchronous broadcasting and `replaySince` remain unchanged.

The [durable replay contract and model examples](https://github.com/stacksjs/stacks/blob/main/storage/framework/core/realtime/docs/durable-replay.md)
cover atomic per-channel sequences, incarnation-bound cursors, bounded retention
and idempotency, response gaps, and the absence of live cluster fan-out or
exactly-once delivery. The deterministic fake is `createMemoryDurableReplayStore`.

Run the package tests from the framework root:

```bash
bun test ./storage/framework/core/realtime/tests
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
