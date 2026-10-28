# Stacks Path

Easily work with file paths.

## ☘️ Features

- Ensures paths are normalized across all Operating Systems
- Easily access the path's basename, dirname, extension, filename, and more
- Drop-in Node.js module replacement
- Written in modern ESM/TypeScript

## 🤖 Usage

```bash
bun install -d @stacksjs/path
```

Now, you can easily access it in your project:

```js
import { filename, normalizeAliases, resolve, resolveAlias } from '@stacksjs/path'

// and more...
```

To view the full documentation, please visit [<https://stacksjs.com/pat>h](https://stacksjs.com/path).

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

## 🙏🏼 Credits

Many thanks to the following core technologies & people who have contributed to this package:

- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙

## Direct-charge financial reconciliation

`directChargeFinancials(paymentIntentId, originalAccount)` reads canonical provider facts on the payment's original connected account. It returns the successful charge, every refund and dispute, its application fee and fee refunds, and their balance transactions. Platform fee reads stay on the platform. All lists are paginated, ownership is verified, and incomplete pagination fails. Importing the helper does not initialize Stripe.

Call after acquiring the application's payment lock. Persist immutable movement IDs with their account scope, and use the normal durable queue to retry `DirectChargeFinancialsPendingError`: fees and balance transactions can appear asynchronously. A missing fee is never inferred to be zero. Do not expose the returned Stripe objects in public responses.

Balance amounts, fees and net remain in their actual settlement currency with the provider exchange rate. Contributor allocations belong in their own presentment-currency ledger; a dispute status alone does not prove reinstatement, and a charge refund does not prove that the application fee was returned.

References: [direct charges](https://docs.stripe.com/connect/direct-charges), [refund pagination](https://docs.stripe.com/api/refunds/list), [disputes](https://docs.stripe.com/api/disputes/list), [application fees](https://docs.stripe.com/api/application_fees/list).
