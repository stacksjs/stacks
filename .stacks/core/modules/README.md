# Stacks Modules

A custom user module system. Place a `.ts` file with the following template & it will be installed automatically.

## 🤖 Usage

```bash
bun install -d @stacksjs/modules
```

Now, you can use it in your project:

```ts
import { type UserModule } from '@stacksjs/types'

export const install: UserModule = ({ app, router, isClient }) => {
  // do something
}
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

[Join the Stacks Discord Server](https://discord.ow3.org)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with ❤️
