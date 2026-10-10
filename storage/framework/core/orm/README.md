# Stacks ORM

wip

## ☘️ Features

-

## 🤖 Usage

```bash
bun install -d @stacksjs/orm
```

You may now use it in your project:

wip

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://stacksjs.com/discord)

## 🙏🏼 Credits

Many thanks to the following core technologies & people who have contributed to this package:

- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙

## Scoped locked operations and stored link credentials

`withLockedRow(table, scope, async (row, tx) => ..., { tx? })` locks and reads
a scoped row on one reserved connection. It returns null for a missing row.
Use the callback handle for every related read/write; `tx` reuses an enclosing
transaction. A scope must identify one row; empty or non-unique scopes are refused. This is the query-builder seam: model
casts, fillable filtering and lifecycle hooks remain the caller's responsibility.

`rowToken({ table, scope, column, action, tx?, timestampColumn? })` manages a
stored share/feed credential. Read returns the live token; enable preserves
it; rotate replaces it; disable clears it. Mutations serialize under the row
lock and join an enclosing transaction when supplied. Missing owners throw
`RowTokenNotFoundError` (404). The default timestamp column is updated_at;
pass false for a table without timestamps. Identifiers and scope must be
application-selected, and the caller must authorize that owner. This is for
stored public-link secrets, not hashed authentication tokens with expiry.
