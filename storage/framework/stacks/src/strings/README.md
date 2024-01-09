# Stacks Strings

Easily manipulate & work with strings.

## ☘️ Features

- Easily manipulate strings
- Powerful & fast API

## 🤖 Usage

```bash
bun install -d @stacksjs/strings
```

Now, you can use it in your project:

```js
import {
  // pluralize
  addIrregularRule,
  addPluralRule,
  addSingularRule,
  addUncountableRule,
  isPlural,
  isSingular,
  singular,
  plural,

  // case
  camelCase,
  capitalCase,
  constantCase,
  dotCase,
  headerCase,
  kebabCase,
  noCase,
  paramCase,
  pascalCase,
  pathCase,
  sentenceCase,
  snakeCase,
  titleCase,

  // validation
  isEmail,
  isStrongPassword,
  isAlphanumeric,
  validateUsername,
  isURL,
  isMobilePhone,
  isAlpha,
  isPostalCode,
  isDate,
  isNumeric,
  isBoolean,
  isHexColor,
  isHexadecimal,
  isBase64,
  isUUID,
  isJSON,
  isCreditCard,
  isISBN,
  isIP,
  isIPRange,
  isMACAddress,
  isLatLong,
  isLatitude,
  isLongitude,
  isCurrency,
  isDataURI,
  isMimeType,
  isJWT,
  isMongoId,
  isAscii,
  isBase32,
  isByteLength,
  isFQDN,
  isFullWidth,
  isHalfWidth,
  isHash,
  isHSL,
  isIBAN,
  isIdentityCard,
  isISIN,
  isISO8601,
  isISRC,
  isISSN,
  isISO31661Alpha2,
  isISO31661Alpha3
} from '@stacksjs/strings'

console.log(camelCase('hello world')) // => "helloWorld"
console.log(plural('dog')) // => "dogs"
```

To view the full documentation, please visit [https://stacksjs.org/strings](https://stacksjs.org/strings).

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

- [change-case](https://www.npmjs.com/package/change-case)
- [pluralize](https://www.npmjs.com/package/pluralize)
- [validation](https://www.npmjs.com/package/validation)
- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
