# Stacks Cache

wip

## ☘️ Features

wip

- ⚡️

wip

## 🤖 Usage

wip

```bash
bun install -d @stacksjs/cache
```

Now, you can use it in your project:

```js
import * as cache from '@stacksjs/cache'

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

## Representation-aware keys

`cacheKey(namespace, dependencies)` creates a deterministic key from named
primitive dependencies. Include owner/tenant scope, content version and every
setting affecting the result (for example privacy, locale or theme). Property
order does not change it; delimiter-containing strings cannot collide. Null
and undefined remain distinct. This constructs identity; it does not observe
settings, grant authorization or invalidate already issued public URLs.
The narrow `@stacksjs/cache/key` entry is pure and browser-bundleable.
