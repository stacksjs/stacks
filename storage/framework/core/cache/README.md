# Stacks Cache

`getOrSet` and `remember` share concurrent misses within one cache instance.
The fetcher deadline rejects every joined caller and discards late results.
Once a result starts being stored, callers remain joined until publication
finishes; backend I/O relies on the selected driver's own connection deadlines.
This prevents a timed-out attempt from overwriting a successful retry.

Tagged `remember` hits retain the stored value's expiry in their tag index.
Finite index entries include a short grace period for drivers that round TTLs
to whole seconds, so the index cannot expire before the value is invalidated.

SQLite validates finite non-negative TTL seconds (including `stdTTL`). Zero
means forever; omitted TTL uses the default. Invalid TTLs throw RangeError and
invalid `mset` batches roll back. `getTtl` returns an absolute epoch-ms expiry,
zero for forever, or undefined for a missing/expired key. `mget` preserves all
own keys, including `__proto__`. SQLite key globs are case-sensitive: only `*`
is a wildcard; omitted patterns list all live keys, empty patterns match only
the empty key.

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
