# Web Components

"Why create components for a specific framework when it can be written to be understood by all — including browsers?"

## 🤝 Introduction

Before you get started, it is important to understand what a Web Component is. Think of it as a (custom) HTML element. This custom element can natively be used within your framework-of-choice. That being said, this is an opinionated starter kit, employing many best-practices, to help you expedite the development of your web component library.

### 👩🏽‍💻 Dev Tools

- [Vite 2.9](https://vitejs.dev/) - "Next Generation Frontend Tooling"
- [Vue 3.2](https://vuejs.org/) - write Web Components the same way you would write SFCs
- [UnoCSS](https://github.com/unocss/unocss) - create your own style guide with ease (e.g. Tailwind CSS)
- [TypeScript 4.7](https://www.typescriptlang.org/)
- [Commitizen & commitlint](https://www.npmjs.com/package/@commitlint/cz-commitlint) - Automate git commits, versioning, and CHANGELOG generation
- [Vitest](https://github.com/vitest-dev/vitest) - Unit testing powered by Vite
- [Cypress](https://cypress.io/) - E2E testing
- [Renovate](https://renovatebot.com/) - automatic PR dependency updates
- [GitHub Actions](https://github.com/features/actions) - automatically fixes code style issues, tags releases, and runs the test suite
- [VS Code Extensions](./.vscode/extensions.json)
  - [Volar](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar) - Vue 3 `<script setup>` IDE support
  - [cspell](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) - spell checking
  - [Windi Intellisense](https://marketplace.visualstudio.com/items?itemName=voorjaar.windicss-intellisense) - Tailwind CSS (or Windi CSS) class name sorter

### 🧩 Plugins

- [`unplugin-vue-components`](https://github.com/antfu/unplugin-vue-components) - components auto import
- [`unplugin-auto-import`](https://github.com/antfu/unplugin-auto-import) - Directly use Vue Composition API and others without importing
- [VueUse](https://github.com/vueuse/vueuse) - Collection of useful composition APIs

### 🥰 Coding Style

- Use Composition API with [`<script setup>` SFC syntax](https://github.com/vuejs/rfcs/pull/227)
- [ESLint](https://eslint.org/) - statically analyzes your code to quickly find problems

When using this template, feel free to adjust it to your needs. This is simply a framework to help you quickly & efficiently develop and design components using industry best-practices.

## 💡 Get Started

It's very easy to get started, especially if you have designed/developed Vue Single File Components before. Check out the index.html and how the `HelloWorld`-component is defined within this repo. Feel free to create any component.

```bash
npx degit openweblabs/web-components-library-starter hello-world-stack
cd hello-world-stack
pnpm i # if you don't have pnpm installed, run `npm install -g pnpm`

# starts the local server at http://localhost:3333 & watches for changes
pnpm dev

# builds the component library for production-ready use
pnpm build

# check out the `package.json` to see the remainder of scripts
```

### Tips

When using VS Code as your code editor, you may want to consider keeping the [vscode.html-data.json](.vscode/vscode.html-data.json) file updated. It provides hints to your code editor and you can find more examples [here](https://github.com/microsoft/vscode-custom-data/blob/main/web-data/html/htmlTags.json).

```bash
# how to create a git commit?
git add . # select the changes you want to commit
pnpm run commit # then simply answer the questions

# after you have successfully committed, you may create a "release"
pnpm run release # automates git commits, versioning, and CHANGELOG generation
```

## 🖥️ Browsers

This starter kit is built for the modern web and avoids bloated polyfills and outdated environments as much as possible. Currently, it supports all browsers that fully implement the [Custom Elements V1][caniuse-custom-el-v1].

- Edge 79+
- Firefox 63+
- Chrome 67+
- Safari 13.1+
- Opera 64+
- iOS Safari 13.7+
- Android Browser 81+
- Opera Mobile 59+
- Chrome for Android 88+

[caniuse-custom-el-v1]: https://caniuse.com/custom-elementsv1

## 📈 Changelog

Please see our [releases](https://github.com/openweblabs/web-components-library-starter/releases) page for more information on what has changed recently.

## 💪🏼 Contributing

Please see [CONTRIBUTING](.github/CONTRIBUTING.md) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/openweblabs/web-components-library-starter/discussions)

For casual chit-chat with others using this package:

[Join the Open Web Discord Server](https://discord.ow3.org)

## 📄 License

The MIT License (MIT). Please see [LICENSE](LICENSE.md) for more information.

Made with ❤️
