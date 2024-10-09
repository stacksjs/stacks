# Your Component Library

This is where you create your components.

> **Note**
> If your project does not require any UI components, you can remove this folder. If your library does include components, you may use this readme as the boilerplate of your component library.

## 💡 Get Started

It's easy to get started. The only prerequisite is a basic understanding HTML, sprinkled with *minimal* JavaScript. In other words, there is virtually no learning curve.

```bash
# you may use this GitHub template or the following command:
bunx stacks new hello-world
cd hello-world

bun i # install deps for all packages
bun dev # stubs the packages for local use
bun dev:vite-vue # starts the dev server
bun build # builds the packages for production-ready use
```

Additionally, the `package.json` contains some useful snippets you likely want to be aware of.

## 🤖 Usage

Because this project is optimized toward the development of easily reusable & composable component libraries, it’s very easy to use (and distribute):

```vue
<script setup lang="ts">
import HelloWorld from 'hello-world-stack'
</script>

<template>
  <HelloWorld name="J Doe" />
</template>
```

### Tips

This project also includes a simple way to handle your versioning. Through semantic commit names, it will also generate the two changelogs: one as part of the GitHub releases & the one markdown file that's stored within the root of the project.

```bash
# how to create a git commit?
git add . # select the changes you want to commit
bun --bun run commit # then simply follow the prompts

# after you successfully committed, you may create a "release"
bun --bun run release # automates git commits, versioning, and CHANGELOG generation
```

Read more about these tips in the docs.

### Dev Tools

- [TypeScript 4.9](https://www.typescriptlang.org/)
- [Vite 3.1](https://vitejs.dev/) - "Next Generation Frontend Tooling"
- [Vue 3.2](https://vuejs.org/) - make easy use of Vue's powerful SFCs
- [UnoCSS](https://github.com/unocss/unocss) - create your own style guide with ease (e.g. Tailwind CSS)
- [Commitizen & git-cz](https://www.npmjs.com/package/git-cz) - Automate git commits, versioning, and CHANGELOG generation
- [Renovate](https://renovatebot.com/) - automatic PR dependency updates
- [GitHub Actions](https://github.com/features/actions) - automatically fixes code style issues, tags releases, and runs the test suite
- [VS Code Extensions](./.vscode/extensions.json)
  - [Volar](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar) - Vue 3 `<script setup>` IDE support
  - [cspell](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) - spell checking

### Plugins

- [`unplugin-vue-components`](https://github.com/unplugin/unplugin-vue-components) - components auto import
- [`unplugin-auto-import`](https://github.com/unplugin/unplugin-auto-import) - Directly use Vue Composition API and others without importing
- [VueUse](https://github.com/antfu/vueuse) - Collection of useful composition APIs
- [Collect.js](https://github.com/ecrmnn/collect.js) - Easily work with object via Laravel-like collections

### Coding Style

- Composition API with [`<script setup>` SFC syntax](https://github.com/vuejs/rfcs/pull/227)
- [ESLint](https://github.com/eslint) - statically analyzes, fixes and formats your code without the need for Prettier

When using this template, feel free to adjust it to your needs. It is a framework to help you quickly & efficiently bootstrap & design component libraries using industry best practices.

## 🧪 Testing

```bash
bun test
```

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/vue-components-library-starter/releases) page for more information on what has changed recently.

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
