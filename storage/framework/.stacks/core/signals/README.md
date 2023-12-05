# Stacks Signals

Stacks proxies [https://github.com/maverick-js/signals](Maverick.js's) signals.

## ☘️ Features

- 🪶 Light (~1kB minzipped)
- 💽 Works in both browsers and Node.js
- 🌎 All types are observable (i.e., string, array, object, etc.)
- 🕵️‍♀️ Only updates when value has changed
- ⏱️ Batched updates via microtask scheduler
- 😴 Lazy by default - efficiently re-computes only what's needed
- 🔬 Computations via computed
- 📞 Effect subscriptions via effect
- 🐛 Debugging identifiers
- 💪 Strongly typed

## 🤖 Usage

```bash
bun install -d @stacksjs/signals
```

You may now use it in your project:

```ts
import { computedSignal, effect, root, signal, tick } from 'stacks:signals'

root((dispose) => {
  // Create - all types supported (string, array, object, etc.)
  const $m = signal(1)
  const $x = signal(1)
  const $b = signal(0)

  // Compute - only re-computed when `$m`, `$x`, or `$b` changes.
  const $y = computedSignal(() => $m() * $x() + $b())

  // Effect - this will run whenever `$y` is updated.
  const stop = effect(() => {
    console.log($y())

    // Called each time `effect` ends and when finally disposed.
    return () => {}
  })

  $m.set(10) // logs `10` inside effect

  // Flush queue synchronously so effect is run.
  // Otherwise, effects will be batched and run on the microtask queue.
  tick()

  $b.set(prev => prev + 5) // logs `15` inside effect

  tick()

  // Nothing has changed - no re-compute.
  $y()

  // Stop running effect.
  stop()

  // ...

  // Dispose of all signals inside `root`.
  dispose()
})
```

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

- [Rahim Alwer](https://github.com/maverick-js/signals)
- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with ❤️
