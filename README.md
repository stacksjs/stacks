<p align="center"><img src=".github/art/social.png" alt="Social Card of Stacks"></p>

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->
<!-- [![Codecov][codecov-src]][codecov-href] -->

# The Modern Component Library

The Stacks Framework helps kick-start & maintain development of your next component library. It is the most simple & comfortable way to build highly-modular, widely-usable & scalable component libraries. No matter whether you are a beginner or an expert, Stacks' approachable design allows you to learn more about its capabilities as you develop your library.

Develop beautiful reactive composable UIs without learning a new language. HTML, CSS, sprinkled with minimal JavaScript—dive in now!

> _The clever way to build your component libraries._

## ☘️ Features

The ultimate goal of this framework, Stacks, is to _help you_ create a component library. Stacks is a highly optimized build process that automatically generates `.mjs` & `.cjs` library distributions for you, including its types. Other core features include:

- Automagically builds & distributes Web Component & Vue (2 & 3) libraries for you
- Zero-config by default, yet highly-configurable—if needed
- Delightful Developer Experience _(DX)_
- Style with ease via UnoCSS _(e.g. Tailwind CSS, Windi CSS, Heroicons, Bootstrap, etc.)_
- Modern git commit conventions
- Automated npm package releases & semver versioning
- Pretty changelog generations _(markdown & GitHub releases)_
- Fully-typed, automatically _(your components & composables)_
- Optimized & automated GitHub PR dependency updates
- Bootstrapped VitePress setup to present your library

## 💡 Get Started

It's easy incredibly easy to get started. The only prerequisite is a basic understanding of how to work with basic HTML & JavaScript. with Vue Single File Components (SFCs). In other words, there is virtually no learning curve because "HTML with sprinkled JavaScript" will get you _incredibly_ far.

```bash
# you may "Use this template" via the button in top right corner of this page
# or run the following commands:
npx degit openwebstacks/stacks-framework hello-world-stack
cd hello-world-stack
npm run setup # WIP
```

## 🤖 Usage

Some commonly used scripts are:

```bash
pnpm install # install all dependencies (for all packages/workspaces)
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

_The `package.json` may contain additional useful snippets you want to be aware of._

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

Stacks is a Component-First, UI & Build Framework. When developing your own library, Stacks bootstraps the following for you:

- [Modern Build engine](https://github.com/openwebstacks/stacks-framework/tree/main/.stacks/builds) - a Stacks optimized [Vite](https://vitejs.dev/) & [unbuild](https://github.com/unjs/unbuild) setup
- [Modern CSS engine](https://github.com/unocss/unocss) - pre-configured UnoCSS allows to create & manage your style guide with ease
- [Fully Typed APIs](https://www.typescriptlang.org/) - via TypeScript 4.7
- [Be a good commitizen](https://www.npmjs.com/package/git-cz) - pre-configured Commitizen & git-cz setup to simplify semantic git commits, versioning, and changelog generations
- [Built with testing in mind](https://github.com/vitest-dev/vitest) - pre-configured unit-testing powered by [Vitest](https://github.com/vitest-dev/vitest) & e2e-testing by [Cypress](https://cypress.io/)
- [Renovate](https://renovatebot.com/) - optimized & automated PR dependency updates
- [GitHub Actions](https://github.com/features/actions) - runs your CI (fixes code style issues, tags releases & creates its changelogs, runs the test suite, etc.

#### Plugins & Extensions

- [Automatically imports components](https://github.com/antfu/unplugin-vue-components)
- [Use framework functionalities without imports](https://github.com/antfu/unplugin-auto-import)
  - [VueUse](https://github.com/antfu/vueuse) - a collection of useful functions
- [VS Code Extensions](./.vscode/extensions.json)
  - [IDE capabilities](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar)
  - [Spell checking](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker)
  - [Utility Class Intellisense](https://marketplace.visualstudio.com/items?itemName=voorjaar.windicss-intellisense) - Tailwind CSS (or Windi CSS) class name sorter

#### Coding Style

- [ESLint](https://eslint.org/) - statically analyzes, fixes and formats your code without the need of Prettier

When using this framework, feel free to adjust it to your needs. It is "simply" is a set of rules to help you quickly & efficiently bootstrap & design component libraries, using industry best-practices.

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
