# Stacks Objects

Easily work with objects.

## ☘️ Features

- Access to Laravel-like Collections API
- Other object helpers

## 🤖 Usage

```bash
bun install -d @stacksjs/objects
```

Now, you can easily access it in your project:

```js
import { collect } from '@stacksjs/objects'

const collection = collect([{
  name: 'My story',
  pages: 176,
}, {
  name: 'Fantastic Beasts and Where to Find Them',
  pages: 1096,
}])

console.log(collection.avg('pages')) // 636
```

To view the full documentation, please visit [<https://stacksjs.com/object>s](https://stacksjs.com/objects).

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

## 🙏🏼 Credits

Many thanks to the following core technologies & people who have contributed to this package:

- [Collect.js](https://github.com/ecrmnn/collect.js)
- [Laravel](https://laravel.com/)
- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙

## Object boundary contracts

`objectKeys` and `objectEntries` report string keys, including numeric property names,
and omit symbols. `mapValues` visits own enumerable string entries; its return type
excludes symbols and preserves optional properties. `getPath` returns `unknown`,
including when a fallback is supplied: narrow the result before using it as a number
or string. A fallback does not determine the type of a present property.

`setPath(array, ['length'], n)` applies native array-length rules to a copy. Invalid
lengths throw without changing the original. A plain source record replaces a nested
Date, Map, Set or class target during `deepMerge`; those targets are not containers
for JSON fields. The package ships both its root and the narrow `objects/transform`
entry as JavaScript and declarations.

`omit` normalizes numeric exclusions. `objectMap` returns a partial record because
callbacks may remove entries. `setPath` preserves sparse slots and own enumerable
array siblings; its `SetPathResult` type follows known paths, with `unknown` for
dynamic paths and the replacement type for an empty path.

`deepMerge` tracks plain-record graphs per source overlay, preserving cycles and
sharing each source node's first destination. It updates the same target; arrays
and non-plain values remain atomic. Later sources use fresh graph tracking.

Path inference normalizes numeric/string aliases and distributes finite union
steps. Broad string/number/template steps and open index-signature object sources
return `unknown`; narrow before using them. Length changes drop fixed tuple index
guarantees, and generic array results include possible holes. Numeric-looking
named siblings such as `-1` and `1.5` retain their own value types.
