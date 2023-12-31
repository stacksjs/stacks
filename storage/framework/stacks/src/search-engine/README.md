# Stacks Search Engine

The Stacks Search Engine is a unified driver system to easily interact with search engines.

## ☘️ Features

- 🔎 Advanced searching
- 🎯 Filtering support
- 📚 Pagination support
- ⬇️ Sorting support
- 🚘 Driver based
- ⚡️ Meilisearch support
- 💀 Headless functions & components

## TODO

- [ ] Driver: Algolia
- [ ] Driver: TypeSense

## 🤖 Usage

```bash
bun install -d @stacksjs/search-engine
```

You may now use:

```ts
import { useSearchEngine } from '@stacksjs/search-engine'

const client = useSearchEngine()
const index = client.index(name)
const results = client.search('Hello World')
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

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
