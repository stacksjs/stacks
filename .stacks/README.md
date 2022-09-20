# @ow3/stacks

This package contains the "core" logic of the framework/monorepo setup, e.g. the build logic (excluding the IDE setup).

## ☘️ Features

The ultimate goal of this framework, Stacks, is to _help you_ create a component and/or function library. Stacks is a toolkit of composables, methods, and other goodies required to build optimized libraries. A highly optimized build process that automatically generates `.mjs` & `.cjs` library distributions for you, including its TypeScript types.

Other included core features are:

- ⚡️ Vite plugins to build the component library
- 🏎 Blazing fast, empowered by a beautiful DX
- 👣 Tiny foot-print in production builds
- 💬 Fully-typed TypeScript definitions
- 🌳 Treeshaking for Vue & Web Components
- 🎨 Optimized UnoCSS build for Vue & Web Components _(defaults to Tailwind CSS utility classes)_
- 🧙🏼‍♀️ Unified way to access hundreds of [icon sets](https://icon-sets.iconify.design)
 — [Icons in Pure CSS](https://antfu.me/posts/icons-in-pure-css)

And all of this in a zero-config, yet configurable, way.

## 🤖 Usage

If you want to use Stacks outside of this framework, install it as a dev dependency:

```bash
pnpm i -D @ow3/stacks
```

Now, you can use it in your project:

```js
import {
  Stacks,
  atomicCssEngine,
  autoImports,
  components,
  createApp,
  defineConfig,
  defineTestConfig,
  inspect,
  resolve,
  uiEngine
} from '@ow3/stacks'

// you are now free to use any of the imported methods
```

Learn more in the docs.

## 🧪 Testing

```bash
pnpm test
```

## 📈 Changelog

Please see our [releases](https://github.com/ow3org/vue-components-library-starter/releases) page for more information on what has changed recently.

## 💪🏼 Contributing

Please see [CONTRIBUTING](../../.github/CONTRIBUTING.md) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/openweblabs/web-components-library-starter/discussions)

For casual chit-chat with others using this package:

[Join the Open Web Discord Server](https://discord.ow3.org)

## 📄 License

The MIT License (MIT). Please see [LICENSE](../../LICENSE.md) for more information.

Made with ❤️
