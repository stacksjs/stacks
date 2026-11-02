# Stacks Queue

Database and Redis job dispatch, workers, scheduling, dead-letter queues, and quarantine.

## Reliability

Database dead-letter retries lock and move the original row in one transaction. Concurrent retries enqueue one copy, and a failed insert preserves the dead-letter entry. `listDeadLetterJobs()` returns at most 100 rows by default; pass a positive integer `limit` to override it.

Scheduled database dispatch commits the queue row and its per-minute marker together. An enqueue failure rolls back the marker so the same minute can retry. Disabled job configurations are excluded from automatic scheduling. Run-marker persistence degrades to the in-memory guard if its table cannot be created.

Circuit observations and poison failure counts seed and lock their state rows inside transactions, including concurrent first observations. Quarantine thresholds apply to the first failure and after a window reset.

New payload quarantine keys use a `v2:` prefix and canonical JSON object key ordering, including nested objects. Array order remains significant. The exported `hashPayload()` retains its legacy digest contract. Existing unversioned rows are checked using that digest and upgraded when a matching original payload representation is encountered. An old digest cannot reveal its original object key order: to make a legacy quarantine immediately order independent, quarantine the payload again or use class-wide `quarantineJob(name)` during migration.

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
