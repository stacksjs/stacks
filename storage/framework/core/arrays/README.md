# Stacks Arrays

This package contains the Stacks Arrays source.

## ☘️ Features

wip

- ⚡️

wip

## 🤖 Usage

wip

```bash
bun install -d @stacksjs/arrays
```

Now, you can use it in your project:

```js
import * as arrays from '@stacksjs/arrays'

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


## Boundary behavior

`at()` and `last()` return `T | undefined` for arrays that may be empty or indexes that
may be out of range. Handle the missing value before dereferencing it. `sample([], n)`
returns an empty array; sample counts must be nonnegative safe integers.

`average()` scales finite inputs when their intermediate sum overflows, and `median()`
uses the same safe midpoint. `min()` and `max()` iterate rather than spreading arguments,
so large browser data sets do not exceed the engine's function argument limit. Empty
statistical inputs retain their existing errors.
