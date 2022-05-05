# Vue Component Library Starter Kit

This is an opinionated Vue Component Library Starter kit to help kick-start development of your next component library.

## 💡 Get Started

It's incredibly easy to get your component library started with this slightly opinionated starter kit. The only prerequisite is a basic understanding of how to design/develop Vue Single File Components (SFCs). In other words, HTML with sprinkled JavaScript will get you really far!

```bash
# you may use this GitHub template or the following command:
npx degit meemalabs/vue-component-library-starter my-lib
cd my-lib

# ensure you also now update your vite.config.ts with your library name

 # if you don't have pnpm installed, run `npm i -g pnpm`
pnpm i # install all deps
pnpm dev # starts the local server at http://localhost:3333 & watches for changes
pnpm build # builds the library for production-ready use
```

Additionally, the `package.json` contains some useful snippets you likely want to be aware of.

## 🤖 Usage

```vue
<script setup lang="ts">
import { HelloWorld } from 'my-lib'
</script>

<template>
  <HelloWorld />
</template>
```

### 👩🏽‍💻 Dev Tools

- [Vite 2.9](https://vitejs.dev/) - "Next Generation Frontend Tooling"
- [Vue 3.2](https://vuejs.org/) - make easy use of Vue's powerful SFCs
- [UnoCSS](https://github.com/unocss/unocss) - create your own style guide with ease (e.g. Tailwind CSS)
- [TypeScript 4.6](https://www.typescriptlang.org/)
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
- [VueUse](https://github.com/antfu/vueuse) - Collection of useful composition APIs

### 🥰 Coding Style

- Use Composition API with [`<script setup>` SFC syntax](https://github.com/vuejs/rfcs/pull/227)
- [Reactivity Transform](https://vuejs.org/guide/extras/reactivity-transform.html) enabled
- [ESLint](https://eslint.org/) - statically analyzes your code to quickly find problems

When using this template, feel free to adjust it to your needs. This is simply a framework to help you quickly & efficiently develop and design components using industry best-practices.

### Tips

This project also includes a simple way to handle your versioning. Through semantic commit names, it will also generate the 2 changelogs: one as part of the GitHub releases & the one markdown file that's created within the root of the project.

```bash
# how to create a git commit?
git add . # select the changes you want to commit
pnpm run commit # then simply answer the questions

# after you have successfully committed, you may create a "release"
pnpm run release # automates git commits, versioning, and CHANGELOG generation

# how to test your library locally?
pnpm pack # packs the library into a tarball
```

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

[Discussions on GitHub](https://github.com/openweblabs/web-components-library-starter/discussions)

For casual chit-chat with others using this package:

[Join the Open Web Discord Server](https://discord.ow3.org)

## 📄 License

The MIT License (MIT). Please see [LICENSE](LICENSE.md) for more information.

Made with ❤️ by Open Web Labs. And many thanks to [antfu](https://github.com/antfu)!
