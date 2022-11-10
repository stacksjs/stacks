# Stacks Strings

Easily manipulate & work with strings.

## ☘️ Features

- Easily manipulate strings
- Powerful & fast API

## 🤖 Usage

```bash
pnpm i -D @stacksjs/strings
```

Now, you can use it in your project:

```js
import {
  plural, singular, isPlural, isSingular, addPluralRule, addSingularRule, addIrregularRule, addUncountableRule
  camelCase, capitalCase, constantCase, dotCase, headerCase, noCase, paramCase,
  kebabCase, pascalCase, pathCase, sentenceCase, snakeCase
} from '@stacksjs/strings'

console.log(camelCase('hello world')) // helloWorld
console.log(plural('dog')) // dogs
```

To view the full documentation, please visit [https://stacksjs.dev/strings](https://stacksjs.dev/strings).

## 🧪 Testing

```bash
pnpm test
```

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## 💪🏼 Contributing

Please see [CONTRIBUTING](../../.github/CONTRIBUTING.md) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Open Web Discord Server](https://discord.ow3.org)

## 🙏🏼 Credits

Many thanks to the following core technologies & people who have contributed to this package:

- [change-case](https://www.npmjs.com/package/change-case)
- [pluralize](https://www.npmjs.com/package/pluralize)
- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with ❤️
