<p align="center"><img src=".github/art/social.png" alt="Social Card of Stacks"></p>

# Stacks - The Modern Monorepo

Stacks help kick-start development of your next monorepo/component library, pre-configured with all the tools you need to get started. Including the superpowers of interoperability.

## 💡 Get Started

It's easy to get your component library started with this starter kit. The only prerequisite is a basic understanding of how to design/develop Vue Single File Components (SFCs). In other words, there is virtually no learning curve because HTML with sprinkled JavaScript will get you incredibly far.

```bash
# you may use this GitHub template or the following command:
npx degit openwebstacks/stacks-starter hello-world-stack
cd hello-world-stack

pnpm i -r # install deps for all packages
pnpm dev # stubs the libraries for local use

# starts the dev server for any of the examples
pnpm dev:vite-vue
pnpm dev:vite-wc

pnpm build # builds the library for production-ready use
```

Additionally, the `package.json` contains some useful snippets you likely want to be aware of.

## 🤖 Usage

Because this monorepo is optimized toward the development of easily reusable & composable component libraries, it's very easy to use (and distribute):

```html
<html>
  <body>
    <hello-world name="Jane Doe"></hello-world>
    <script src="elements.js"></script>
  </body>
</html>
```

_Optional: if you prefer using Vue_

```vue
<script setup lang="ts">
import HelloWorld from 'hello-world-stack'
</script>

<template>
  <HelloWorld name="J Doe" />
</template>
```

### Tips

This project also includes a simple way to handle your versioning. Through semantic commit names, it will also generate the 2 changelogs: one as part of the GitHub releases & the one markdown file that's created within the root of the project.

```bash
# how to create a git commit?
git add . # select the changes you want to commit
pnpm run commit # then simply follow the prompts

# after you successfully committed, you may create a "release"
pnpm run release # automates git commits, versioning, and CHANGELOG generation
```

Read more about these tips in the docs.

### Dev Tools

- [TypeScript 4.7](https://www.typescriptlang.org/)
- [Vite 2.9](https://vitejs.dev/) - "Next Generation Frontend Tooling"
- [Vue 3.2](https://vuejs.org/) - make easy use of Vue's powerful SFCs
- [UnoCSS](https://github.com/unocss/unocss) - create your own style guide with ease (e.g. Tailwind CSS)
- [Commitizen & commitlint](https://www.npmjs.com/package/@commitlint/cz-commitlint) - Automate git commits, versioning, and CHANGELOG generation
- [Vitest](https://github.com/vitest-dev/vitest) - Unit testing powered by Vite
- [Cypress](https://cypress.io/) - E2E testing
- [Renovate](https://renovatebot.com/) - automatic PR dependency updates
- [GitHub Actions](https://github.com/features/actions) - automatically fixes code style issues, tags releases, and runs the test suite
- [VS Code Extensions](./.vscode/extensions.json)
  - [Volar](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar) - Vue 3 `<script setup>` IDE support
  - [cspell](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) - spell checking
  - [Intellisense](https://marketplace.visualstudio.com/items?itemName=voorjaar.windicss-intellisense) - Tailwind CSS (or Windi CSS) class name sorter

### Plugins

- [`unplugin-vue-components`](https://github.com/antfu/unplugin-vue-components) - components auto import
- [`unplugin-auto-import`](https://github.com/antfu/unplugin-auto-import) - Directly use Vue Composition API and others without importing
- [VueUse](https://github.com/antfu/vueuse) - Collection of useful composition APIs

### Coding Style

- Composition API with [`<script setup>` SFC syntax](https://github.com/vuejs/rfcs/pull/227)
- [ESLint](https://eslint.org/) - statically analyzes your code to quickly find problems

When using this template, feel free to adjust it to your needs. It simply is a framework to help you quickly & efficiently bootstrap & design component libraries using industry best-practices.

## 🧪 Testing

```bash
pnpm test
```

## 📈 Changelog

Please see our [releases](https://github.com/openwebstacks/stacks-starter/releases) page for more information on what has changed recently.

## 💪🏼 Contributing

Please see [CONTRIBUTING](.github/CONTRIBUTING.md) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/openwebstacks/stacks-starter/discussions)

For casual chit-chat with others using this package:

[Join the Open Web Discord Server](https://discord.ow3.org)

## 📄 License

The MIT License (MIT). Please see [LICENSE](LICENSE.md) for more information.

Made with ❤️
