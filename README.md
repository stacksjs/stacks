<p align="center"><img src=".github/art/social.png" alt="Social Card of Stacks"></p>

_Under heavy development during this week, drilling down on the "closer-to-final" API to create the most simple & reusable component library kit for developers. Blog post incoming as well—and until then, wip commits it is._

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->
<!-- [![Codecov][codecov-src]][codecov-href] -->

# The Modern Component Library

The Stacks Framework helps kick-start development of your next component library, in a monorepo type-of-way, pre-configured with all the bells & whistles you need to get started, and be productive.

> _The clever way to build component libraries._ - Chris Breuer

## ☘️ Features

The ultimate goal of this framework is to assist in creating an interoperable library via an optimized build (Vite & unbuild) & DX, to reach the broadest developer audience.

- simply & rapidly develop component libraries
- a beautiful Developer Experience (DX)
- automated git commits, versioning, and changelog generations
- automated npm package releases
- optimized & automated PR dependency updates
- next-generation docs generator
- create your own style guide with ease via UnoCSS (e.g. Tailwind CSS)

## 💡 Get Started

It's easy to get your component library started with this starter kit. The only prerequisite is a basic understanding of how to work with Vue Single File Components (SFCs). In other words, there is virtually no learning curve because "HTML with sprinkled JavaScript" will get you _incredibly_ far.

```bash
# you may "Use this [GitHub] template" or run the following command:
npx degit openwebstacks/stacks-framework hello-world-stack
cd hello-world-stack
```

## 🤖 Usage

The `package.json` contains some useful snippets you likely want to be aware of. Some commonly used ones are:

```bash
pnpm i -r # install all dependencies (for all packages)
pnpm fresh # fresh reinstall of all dependencies

pnpm dev # stubs the libraries for local use
pnpm example # run one of the examples (follow CLI prompts)

pnpm build # builds a specific package (follow CLI prompts)
pnpm build:all # builds the library for production-ready use

pnpm commit # follow CLI prompts for committing changes
pnpm release # releases the library (packages) to npm

pnpm docs:dev # starts local server for the documentation site
pnpm docs:build # builds the documentation site
pnpm docs:serve # serves the documentation site
```

Because this monorepo is optimized toward the development of easily reusable & composable component libraries, it's simple easy to use:

```html
<html>
  <body>
    <hello-world name="Jane Doe"></hello-world>
    <script src="elements.js"></script>
  </body>
</html>
```

Optionally, if you prefer using Vue:

```vue
<script setup lang="ts">
import HelloWorld from 'hello-world-stack'
</script>

<template>
  <HelloWorld name="J Doe" />
</template>
```

Read more about the setup & tips in the docs.

### Developer Experience (DX)

- [TypeScript 4.7](https://www.typescriptlang.org/) - automatically be fully typed
- [Vite 2.9](https://vitejs.dev/) - blazing fast build tool
- [unbuild](https://github.com/unjs/unbuild) - a unified JS/TS build system & "passive watching"
- [Vue](https://vuejs.org/) - UI framework (make easy use of Vue's powerful SFCs)
- [UnoCSS](https://github.com/unocss/unocss) - create & manage your own style guide with ease (e.g. Tailwind CSS)
- [Commitizen & commitlint](https://www.npmjs.com/package/@commitlint/cz-commitlint) - automate git commits, versioning, and CHANGELOG generation
- [Vitest](https://github.com/vitest-dev/vitest) - unit testing powered by Vite
- [Cypress](https://cypress.io/) - e2e testing
- [Renovate](https://renovatebot.com/) - optimized & automated PR dependency updates
- [GitHub Actions](https://github.com/features/actions) - automatically fixes code style issues, tags releases, and runs the test suite

#### Plugins & Extensions

- [`unplugin-vue-components`](https://github.com/antfu/unplugin-vue-components) - components auto import
- [`unplugin-auto-import`](https://github.com/antfu/unplugin-auto-import) - Directly use Vue Composition API and others without importing
- [VueUse](https://github.com/antfu/vueuse) - Collection of useful composition APIs
- [VS Code Extensions](./.vscode/extensions.json)
  - [Volar](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar) - Vue 3 `<script setup>` IDE support
  - [cspell](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) - spell checking
  - [Intellisense](https://marketplace.visualstudio.com/items?itemName=voorjaar.windicss-intellisense) - Tailwind CSS (or Windi CSS) class name sorter

#### Coding Style

- Composition API with [`<script setup>` SFC syntax](https://github.com/vuejs/rfcs/pull/227)
- [ESLint](https://eslint.org/) - statically analyzes your code to quickly find problems

When using this template, feel free to adjust it to your needs. It simply is a framework to help you quickly & efficiently bootstrap & design component libraries using industry best-practices.

## 🧪 Testing

```bash
pnpm test
```

## 📈 Changelog

Please see our [releases](https://github.com/openwebstacks/stacks-framework/releases) page for more information on what has changed recently.

## 💪🏼 Contributing

Please see [CONTRIBUTING](.github/CONTRIBUTING.md) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/openwebstacks/stacks-framework/discussions)

For casual chit-chat with others using this package:

[Join the Open Web Discord Server](https://discord.ow3.org)

## 📄 License

The MIT License (MIT). Please see [LICENSE](LICENSE.md) for more information.

Made with ❤️

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/@ow3/hello-world-vue?style=flat-square
[npm-version-href]: https://npmjs.com/package/@ow3/hello-world-vue

[npm-downloads-src]: https://img.shields.io/npm/dm/@ow3/hello-world-vue?style=flat-square
[npm-downloads-href]: https://npmjs.com/package/@ow3/hello-world-vue

[github-actions-src]: https://img.shields.io/github/workflow/status/openwebstacks/stacks-framework/CI/main?style=flat-square
[github-actions-href]: https://github.com/openwebstacks/stacks-framework/actions?query=workflow%3Aci

<!-- [codecov-src]: https://img.shields.io/codecov/c/gh/openwebstacks/stacks-framework/main?style=flat-square
[codecov-href]: https://codecov.io/gh/openwebstacks/stacks-framework -->
