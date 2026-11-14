# Stacks Types

This package contains the Stacks TypeScript types.

## Library configuration

The library entrypoint provides configuration types for functions, components,
web components and their native release lifecycle:

```ts
import type { LibraryConfig } from '@stacksjs/types/library'

export default {
  repository: 'example/widgets',
  releaseable: true,
  release: { publisher: 'bun', distTag: 'alpha' },
  packages: [{ name: '@example/widgets', kind: 'functions', registry: 'npm' }],
} satisfies LibraryConfig
```

Its declarations depend only on the library configuration types and component
tag metadata. The same public subpath includes an executable empty module for
tools that resolve configuration entrypoints at runtime.

## ☘️ Features

wip

- ⚡️

wip

## 🤖 Usage

wip

```bash
bun install -d @stacksjs/types
```

Now, you can use it in your project:

```js
// import * as types from '@stacksjs/types'

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
