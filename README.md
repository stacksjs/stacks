<p align="center"><img src=".github/art/social.png" alt="Social Card of Stacks"></p>

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->
<!-- [![Codecov][codecov-src]][codecov-href] -->

# The Modern Component & Function Library

The ultimate goal of the Stacks Framework is to _help you_ create & maintain component & function libraries. It is the most simple & comfortable solution for developers to build highly-modular, widely-accepted & scalable libraries, in a beginner-friendly way.

> _The clever way to build component & function libraries._

**🤖 Zero-config by default**  

The highly optimized Stacks bundler automagically builds & distributes CommonJS & module library formats. Stacks also automatically generates a Web Component library, Vue 2 & 3 libraries, a composables/functions library, plus all of its relating component & composable type declarations.

**🎨 Style with ease**

Create your own style guide using conventions you are familiar with via UnoCSS. _(e.g. Tailwind CSS, Windi CSS, Heroicons, Bootstrap, etc.)_

**⚡️ Next-Gen Developer Experience _(DX)_**

Whether it is the simple setup, modern git commit conventions via commitlint, a modern CI, automated npm package releases & semver versioning, pretty changelog generations, GitHub PR dependency updates, spell-checking, integrated documentation tooling, or a pre-configured playground & examples. _Stacks has it all._

**💡 Delightful VS Code integration**

IDE Capabilities, such as type hints, code completion, code formatting, and more, are all natively built-in within Stacks. _Without the need of Prettier._

**🧙🏼‍♀️ Extremely beginner & expert-friendly**

No matter whether you are a beginner or an expert, the approachable Stacks design allows you to learn at your own pace.

Develop beautiful, reactive, composable UIs & functions without learning a new set of languages. HTML, CSS, and minimal JavaScript—that's all you need to dive in now!

## Get Started

It's incredibly easy to get started with this framework. It's as simple as "Using this template" via the button in top right corner of this page, or run the following snippet of code in your terminal:

```bash
pnpm create stack hello-world # wip - check back this weekend!

# alternatively, if pnpm is not installed but npm is:
npx degit openwebstacks/stacks-framework#v0.22.1 hello-world
```

## 🤖 Usage

The following is a list of some of the most common ways to use interact with Stacks:

```bash
# this functionality is WIP
npx artisan install # installs deps (for all workspaces)
npx artisan fresh # fresh reinstall of all deps

npx artisan dev # runs a local dev server of your stack
npx artisan example # select to run one of examples (follow CLI prompts)

npx artisan commit # follow CLI prompts for committing changes
npx artisan release # releases the library (packages) to npm

# build for production-ready use
npx artisan build # builds a specific package (follow CLI prompts)
npx artisan build:functions # builds the function library
npx artisan build:components # builds the component libraries
npx artisan build:all # builds component & function libraries

npx artisan docs:dev # starts local server for documentation site
npx artisan docs:build # builds docs for production deployment
```

_The `package.json` contains additional useful snippets you may want to be aware of._

Because we optimize toward the development of easily reusable & composable component & function libraries, our primary intention is to always _keep it simple, yet configurable_:

```html
<html>
  <body>
    <hello-world name="Jane Doe"></hello-world>
    <script src="hello-world-elements.js"></script>
  </body>
</html>
```

Optionally, if you prefer using Vue:

```vue
<script setup lang="ts">
import HelloWorld from 'hello-world-vue'
</script>

<template>
  <HelloWorld name="J Doe" />
</template>
```

When using this framework, feel free to adjust it to your needs. It is "simply" a set of rules to help you quickly & efficiently bootstrap & design component libraries, using industry best-practices.

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
