# Stacks Commerce

wip

## ☘️ Features

wip

- ⚡️

wip

## 🤖 Usage

wip

```bash
bun install -d @stacksjs/commerce
```

Now, you can use it in your project:

```js
import * as commerce from '@stacksjs/commerce'

// wip
```

### Shop rules in the browser

Four modules are pure and import nothing, so a page bundles them on its own
instead of the barrel (which imports the database):

```ts
import { formatCurrency, parseMoneyInput } from '@stacksjs/commerce/money'
import { addToBasket, basketTotal, stockLabel, CENTS_FIELDS } from '@stacksjs/commerce/register'
import { compareCatalog, matchesSearch, isLowStock } from '@stacksjs/commerce/catalog'
import { releaseSchedule, rolloutFromProduct, describeRollout } from '@stacksjs/commerce/releases'

// A front desk's basket, held to the stock on the shelf
let basket = addToBasket([], gatorade, CENTS_FIELDS)
basketTotal(basket, catalog, CENTS_FIELDS)

// A catalog by category, then name, sizes small to large
products.sort(compareCatalog(['Drinks', 'Apparel']))

// When each video or week of a digital product opens for a buyer
releaseSchedule(rolloutFromProduct(product), weeks, purchasedAt, new Date())
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

## Input and inventory abstractions

`parseSalesTaxSetup(body, { maxRate?, maxRates? })` requires an explicit rates
array, rejects coerced prices/text and duplicate normalized component codes,
and accepts [] only as deliberate removal. HQ-style stores can set maxRate
to 30; the general default is 100. This validates configuration, not the legal
rate applicable to a sale. `parseTaxRateWriteData` is also used by native tax
store/update/bulk operations so false form booleans cannot select a default.

`restockedQuantity(current, units, maximum?)` adds positive whole units,
refusing untracked stock and overflow. `commerce.products.items.restock(id, units)`
uses that rule under a row lock and reads back on its own connection;
`updateInventory` validates absolute quantities through the same boundary.
Pure narrow entries are commerce/inventory and commerce/tax-input.
