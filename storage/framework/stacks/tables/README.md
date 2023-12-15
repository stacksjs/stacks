# Table Stack

The easy & modern way to work with tables of any size. Blazing-fast searching, filtering, sorting, and paginating. Powered by your search engine of choice. Kick-start the development of a feature-rich & configurable table UI, including a beautiful default UX.

## 🐙 Features

This Vue component library comes with the following features, improvements to the `table` element:

- `<table-v2 />`
  - quickly spin up a highly-configurable table UI without worrying about the backend
  - "facet-filtering" & "table head sorting" natively built-in
  - Meilisearch & Laravel Scout API compatible
  - Enterprise-ready
  - _Soon: Algolia & Typesense integration_

Get granular control over the table appearance & behavior, with the following (optional) components:

- `<table-search />`
  - configure your search input for blazing fast search results

- `<table-filters />`
  - overwrite the default display of your table's filters

- `<table-pagination />`
  - easily configure the pagination of your table

- `<table-configure />`
  - simple way to configure the table in HTML semantic fashion

Read more about these features in their respective [docs](https://ow3.org/docs).

## 💡 Get Started

To get started, you simply need to install the `@stacksjs/table-vue` npm package.

```bash
npm install @stacksjs/table-vue
bun add @stacksjs/table-vue
```

Next up, we need to make use of the components.

```vue
<script setup>
import { Table as TableV2 } from 'table-vue'
</script>

<template>
  <!-- the `type`-property indicates to to the search engine the "index" you want to target -->
  <TableV2 type="movies" />

  <!-- these are the default properties (all of them are optional)  -->
  <TableV2
    source="127.0.0.1:7700"
    columns="*"
    :searchable="true"
    :filterable="true"
    :sortable="true"
    :actionable="true"
    :selectable="false"
    :per-page="20"
  />

  <!-- another "data table" example -->
  <TableV2
    source="127.0.0.1:7700"
    password="NtUvZv5Q87e355b807622149c350ac38679645b4e2603a1d3eb48cda080f977e76329aeb"
    type="orders"
    columns="id: Order, customer_name: Customer, customer_po: PO#, part_name: Part, created_at: Ordered, due_at: Due, stage_name: Status"
    sort="id:desc"
    sorts="id, customer_name, customer_po, part_name, stage_name, due_at, created_at"
    filters="customer_name, vendor_name, part_name, document_types"
    actions="Edit"
    per-page="10"
    selectable="true"
  />
</template>
```

To learn more about what's possible & how to best build modern data tables, check out our documentation.

## 🧪 Testing

```bash
yarn test
```

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/table/releases) page for more information on what has changed recently.

## 🚜 Contributing

Please see [CONTRIBUTING](.github/CONTRIBUTING.md) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Table Elements on GitHub](https://github.com/stacksjs/table/discussions)

For casual chit-chat with others using this package:

[Join the Open Web Discord Server](https://discord.gg/stacksjs)

## 📄 License

The MIT License (MIT). Please see [LICENSE](LICENSE.md) for more information.

Made with 💙 by Open Web Labs.
