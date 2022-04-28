# Vue Component Library Starter Kit

This is an opinionated Vue Component Library Starter kit to help kick-start development of your next component library.

## 💡 Get Started

It's incredibly easy to get your component library started with this slightly opinionated starter kit. You simply need to know how to design/develop Vue Single File Components.

```bash
# you may use this GitHub template or the following command:
npx degit meemalabs/vue-component-library-starter my-awesome-vue-component-lib
cd my-awesome-vue-component-lib

# ensure you also now update your vite.config.ts with your library name

 # if you don't have pnpm installed, run `npm i -g pnpm`
pnpm i # install all deps
pnpm dev # starts the local server at http://localhost:3333 & watches for changes
pnpm build # builds the library for production-ready use
```

Additionally, the `package.json` contains some useful snippets you likely want to be aware of.

## Usage

```vue
<script setup lang="ts">
import { MyButton } from 'my-awesome-vue-component-lib'
import '/node_modules/my-awesome-vue-component-lib/dist/style.css'
</script>
```

### How To Create Releases

In order to automate package releases, this starter kit is setup to use [Semantic Commit Style](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716) & GitHub Actions. Once you are ready to create a new release, simply "create a new tag" (e.g. v1.2.0). The creation of the tag will trigger a `tag-release` GitHub Action.

Lastly, login to your npm account and add your newly created repository.

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
  - [Volar](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar) - Vue 3 `<script setup>` IDE support _(ensure Vetur is turned off)_
  - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) - Statically analyzes your code to quickly find problems

### 🧩 Plugins

- [`unplugin-vue-components`](https://github.com/antfu/unplugin-vue-components) - components auto import
- [`unplugin-auto-import`](https://github.com/antfu/unplugin-auto-import) - Directly use Vue Composition API and others without importing
- [VueUse](https://github.com/antfu/vueuse) - Collection of useful composition APIs

### 🥰 Coding Style

- Use Composition API with [`<script setup>` SFC syntax](https://github.com/vuejs/rfcs/pull/227)
  - [Reactivity Transform](https://vuejs.org/guide/extras/reactivity-transform.html) enabled
- [ESLint](https://eslint.org/) - statically analyzes your code to quickly find problems
- [Prettier](https://prettier.io/) - required for Tailwind class name sorting

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
