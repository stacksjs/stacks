# The Components Folder

This is where you create your components.

> **Note**
> If your project does not require any UI components, you can remove this folder. If your library does include components, you may use this readme as the boilerplate of your component library.

## 💡 Get Started

It's easy to get started. The only prerequisite is a basic understanding of HTML, sprinkled with *minimal* JavaScript. In other words, there is virtually no learning curve.

```bash
# you may use this GitHub template or the following command:
bunx stacks new hello-world
cd hello-world

buddy install # install deps for all packages
buddy dev:components # starts the component dev server
buddy build:components # builds the component library for production-ready use
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
buddy commit # then simply follow the prompts

# after you successfully committed, you may create a "release"
buddy release # automates git commits, versioning, and CHANGELOG generation
```

Read more about these tips in the docs.

### Coding Style

You may want to consider using the "Composition API" with [`<script setup>` SFC syntax](https://github.com/vuejs/rfcs/pull/227), as it is perfectly suited for building component libraries via Stacks. [ESLint](https://github.com/eslint) also comes pre-configured to statically analyze, fix and format your code without the need for Prettier.

When using this template, feel free to adjust it to your needs. It is a framework to help you quickly & efficiently bootstrap and design component libraries using industry best practices.

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
