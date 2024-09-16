# Bun Spreadsheets

Easily generate spreadsheets, like CSVs and Excel files.

## ☘️ Features

- Generate CSV files
- Generate Excel files
- Store spreadsheets to disk
- Download spreadsheets as a Response object
- Simple API for creating and manipulating spreadsheets
- Fully typed
- Optimized for Bun
- Lightweight & dependency-free

## 🤖 Usage

```bash
bun install bun-spreadsheets
```

Now, you can use it in your project:

```ts
import { createSpreadsheet } from 'bun-spreadsheets'

// Create a spreadsheet
const data = {
  headings: ['Name', 'Age', 'City'],
  data: [
    ['John Doe', '30', 'New York'],
    ['Jane Smith', '25', 'London'],
    ['Bob Johnson', '35', 'Paris']
  ]
}

// Generate a CSV spreadsheet
const csvSpreadsheet = createSpreadsheet(data, 'csv')

// Generate an Excel spreadsheet
const excelSpreadsheet = createSpreadsheet(data, 'excel')

// Store the spreadsheet to disk
await spreadsheet.store(csvSpreadsheet, 'output.csv')

// Create a download response
const response = spreadsheet.download(excelSpreadsheet, 'data.xlsx')
```

To view the full documentation, please visit [https://stacksjs.org/docs/bun-spreadsheets](https://stacksjs.org/docs/bun-spreadsheets).

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

- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
