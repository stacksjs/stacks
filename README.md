# Web Component Library Starter Kit

"Why create components for a specific framework when it can be written to be understood by all — including browsers?"

## 👋🏼 Introduction

Before you get started, it's is important to understand what a Web Component is. Think of it as a (custom) HTML element. That being said, this is an opinionated starter kit to help you expedite the development of your component library.

### 👩🏽‍💻 Dev Tools

- [TypeScript 4.6](https://www.typescriptlang.org/)
- [Vue 3.2](https://vuejs.org/) - write Web Components the same way you would write SFCs
- [Vitest](https://github.com/vitest-dev/vitest) - Unit testing powered by Vite
- [Cypress](https://cypress.io/) - E2E testing
- [Tailwind CSS](https://tailwindcss.com/) - create your own style guide with ease
- [Renovate](https://renovatebot.com/) - Automatically PR dependency updates
- [GitHub Actions](https://github.com/features/actions) - Commit code style fixes automatically, tag releases, and run the test suite
- [VS Code Extensions](./.vscode/extensions.json)
  - [Vite](https://marketplace.visualstudio.com/items?itemName=antfu.vite) - Fire up Vite server automatically
  - [Volar](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar) - Vue 3 `<script setup>` IDE support
  - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) - Statically analyzes your code to quickly find problems

### 🧩 Plugins

- [`unplugin-vue-components`](https://github.com/antfu/unplugin-vue-components) - components auto import
- [`unplugin-auto-import`](https://github.com/antfu/unplugin-auto-import) - Directly use Vue Composition API and others without importing
- [VueUse](https://github.com/antfu/vueuse) - Collection of useful composition APIs
- [Vitebook](https://vitebook.dev) - A modern open source Storybook alternative

### 🥰 Coding Style

- Use Composition API with [`<script setup>` SFC syntax](https://github.com/vuejs/rfcs/pull/227)
  - [Reactivity Transform](https://vuejs.org/guide/extras/reactivity-transform.html) enabled
- [ESLint](https://eslint.org/) - statically analyzes your code to quickly find problems
- [Prettier](https://prettier.io/) - Opinionated code formatting, like Tailwind class name sorting

## 💡 Get Started

It's very easy to get your component library started with this slightly opinionated ", especially if you have designed/developed Vue Single File Components before. Check out the index.html and how the `HelloWorld`-component is defined within this repo. Feel free to create any component.

```bash
npx degit meemalabs/vue-component-library-starter my-vue-component-library
cd my-vue-component-library

pnpm i # if you don't have pnpm installed, run `npm i -g pnpm`
pnpm dev # starts the local server at http://localhost:3333/ & watches for changes
pnpm build # builds the library for production-ready use
```

Additionally, the `package.json` contains some useful snippets you likely want to be aware of.

## 🧪 Testing

```bash
pnpm test
```

## 📈 Changelog

Please see our [releases](https://github.com/meemalabs/web-components-library-starter/releases) page for more information on what has changed recently.

## 💪🏼 Contributing

Please see [CONTRIBUTING](.github/CONTRIBUTING.md) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/meemalabs/web-components-library-starter/discussions)

For casual chit-chat with others using this package:

[Join the Meema Discord Server](https://discord.meema.io)

## 📄 License

The MIT License (MIT). Please see [LICENSE](LICENSE.md) for more information.

Made with ❤️ by Meema Labs. And many thanks to [antfu](https://github.com/antfu)!
