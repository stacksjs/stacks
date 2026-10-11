# Stacks Database

wip

## ☘️ Features

wip

- ⚡️

wip

## 🤖 Usage

wip

```bash
bun install -d @stacksjs/database
```

Now, you can use it in your project:

```js
import * as database from '@stacksjs/database'

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

## Group row locks

lockRows(tx, table, ids, { key?, scope? }) from database/runtime acquires
unique numeric primary keys in deterministic order and returns a map keyed by their
canonical numeric string value, so padded numeric inputs cannot reverse lock order. Missing scoped rows map to undefined. The caller must supply a
transaction handle and choose ownership filters; reads, writes and validation
remain on that handle. This prevents opposite input order from creating a
lock-order cycle during a transfer, merge or multi-item stock reservation.

`lockRow(tx, table, scope, { mode: 'no_key_update' })` uses PostgreSQL's
`FOR NO KEY UPDATE` for parent rows whose key will stay fixed. It serializes
other non-key updates while allowing child inserts to acquire foreign-key
key-share locks. Acquire the parent before child locks consistently; a strong
`FOR UPDATE` parent lock can deadlock with a child-first insert. MySQL retains
its stronger `FOR UPDATE` lock, and SQLite relies on the surrounding transaction.
The default remains `update`; changing or deleting the parent key needs that
stronger lock. Group locks accept the same mode.
