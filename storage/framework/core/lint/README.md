# Stacks Lint

Easily get your project linted. It "just works."

## ☘️ Features

- Single quotes, no semi
- Auto fix for formatting (aimed to be used as standalone without Prettier)
- Designed to work with TypeScript, Vue out-of-box (React opt-in)
- Lint also for json, yaml, markdown
- Sorted imports, dangling commas for cleaner commit diff
- Improved component library linting & formatting
- Stacks support
- Laravel support
- ESLint wrapper
- And various other minor additions, i.e. `no-constant-binary-expression` usage

> "Reasonable defaults, best practices, only one-line of config."

## 🤖 Usage

```bash
bun install -d @stacksjs/lint
```

Now, you can easily access it in your project:

```js
import lint from '@stacksjs/lint'

// ...
```

To view the full documentation, please visit [<https://stacksjs.com/lin>t](https://stacksjs.com/lint).

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

- [ESLint](https://github.com/eslint)
- [antfu](https://github.com/antfu/eslint-config)
- [publint](https://github.com/bluwy/publint)
- [lint-staged](https://github.com/okonet/lint-staged)
- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
