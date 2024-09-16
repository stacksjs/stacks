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
import { spreadsheet, createSpreadsheet } from 'bun-spreadsheets'

// Create a spreadsheet
const data = {
  headings: ['Name', 'Age', 'City'],
  data: [
    ['John Doe', '30', 'New York'],
    ['Jane Smith', '25', 'London'],
    ['Bob Johnson', '35', 'Paris']
  ]
}

// Generate and manipulate spreadsheets

// 1. Using createSpreadsheet function
const csvSpreadsheet = createSpreadsheet(data, { type: 'csv' })
const excelSpreadsheet = createSpreadsheet(data, { type: 'excel' })

// Store the spreadsheet to disk
await csvSpreadsheet.store('output.csv')

// Create a download response
const response1 = excelSpreadsheet.download('data.xlsx')

// 2. Using spreadsheet object directly
const csvContent = spreadsheet.generateCSV(data)
await csvContent.store('output2.csv')

const excelContent = spreadsheet.generateExcel(data)
await excelContent.store('output3.xlsx')

// Or chain the methods directly
await spreadsheet.generateCSV(data).store('output4.csv')
await spreadsheet.generateExcel(data).store('output5.xlsx')

// Create a download response for Excel
const response2 = spreadsheet(data).excel().download('data2.xlsx')

// 3. Chaining methods
const response3 = spreadsheet(data).csv().download('data3.csv')
await spreadsheet(data).store('output3.xlsx')

// 4. Accessing raw content
const rawCsvContent = spreadsheet(data).csv().getContent()
const rawExcelContent = spreadsheet(data).excel().getContent()

console.log('CSV Content:', rawCsvContent)
console.log('Excel Content:', rawExcelContent)
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
