<p align="center"><img src=".github/art/social.png" alt="Social Card of Stacks"></p>

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->
<!-- [![Codecov][codecov-src]][codecov-href] -->

# The Modern Component & Function Library

The ultimate goal of the Stacks Framework is to _help you_ create & maintain component & function libraries. It shouldn't be a chore creating & maintaining them! Stacks allows you to easily build highly-modular, widely-accepted & scalable libraries—in beginner & expert-friendly ways—embodying [Component-First Design](/component-first-design.md) principles.

> _The clever way to build component & function libraries._

**🤖 Zero-config, by design**

The Stacks bundler automagically generates a Web Component library, Vue 2 & 3 libraries, a composable functions library, plus all of its relating component & composable type declarations.

**🎨 Style with ease**

Create your own style guide using conventions you are familiar with. UnoCSS's atomic CSS engine allows for just that in a blazing-fast way _(e.g. Tailwind CSS, Windi CSS, Heroicons, Bootstrap, etc.)_.

**✨ Next-gen Developer Experience _(DX)_**

Whether it is the simplistic artisan setup, the modern git commit conventions via commitlint, the simple CI, automated npm package releases & semver versioning, pretty changelog generations, automated GitHub PR dependency updates, built-in spell-checking, integrated documentation tooling, or the pre-configured playground & examples... _Stacks has it all._

**💡 First-class VS Code integration**

IDE Capabilities, such as type hints, code completion, code formatting, and more, are all natively built-in within Stacks. _Without the need of Prettier._

**🧙🏼‍♀️ Extremely beginner & expert-friendly**

No matter whether you are a beginner or an expert, the approachable Stacks design allows you to learn at your own pace.

Develop beautiful, reactive, composable UIs & functions without learning a new set of languages. HTML, CSS, and minimal JavaScript—that's all you need to dive in now!

## Get Started

It's incredibly easy to get started with this framework. You may "Use this template" (via the button in top right corner of this page), or run the following snippet of code in your terminal:

```bash
npx artisan make:stack hello-world
```

Please ensure to use Node.js v16.10 or higher. _Stacks is also `fnm` & `nvm` friendly._

## 🤖 Usage

The following is a list of some of the most common ways to use interact with the Stacks API. Meet the Stacks Toolkit:

```bash
# develop locally, to be released with 0.23.0
npx artisan install # or `pnpm i`
npx artisan dev # start one of the dev servers (components, functions, or docs)
npx artisan commit # follow CLI prompts for committing staged changes
npx artisan release # creates the releases for the stack & consequently, publishes them to npm

npx artisan make:component HelloWorld # bootstraps a HelloWorld component
npx artisan make:function hello-world # bootstraps a HelloWorld function
```

<details>
<summary>View the complete Stacks Toolkit</summary>

```bash
npx artisan install # or `pnpm i`
npx artisan fresh # fresh reinstall of all deps

npx artisan dev # start one of the dev servers (components, functions, or docs)
npx artisan dev:components # starts local dev server for playground
npx artisan dev:functions # stubs the functions
npx artisan dev:docs # starts local dev server for docs

npx artisan make:component HelloWorld
npx artisan make:function hello-world
npx artisan make:stack hello-world

npx artisan stub # stubs all the libraries
npx artisan stub:components # stubs the component library
npx artisan stub:functions # stubs the function library

npx artisan lint # runs linter
npx artisan lint:fix # runs linter and fixes issues

npx artisan commit # follow CLI prompts for committing staged changes
npx artisan release # creates the releases for the stack & triggers the Release Action (workflow)
npx artisan changelog # generates CHANGELOG.md

# building for production
npx artisan build # select a specific build (follow CLI prompts)
npx artisan build:all # builds all libraries automagically
npx artisan build:elements # builds the Web Component (Custom Element) library
npx artisan build:vue # builds the Vue 2 & 3 libraries
npx artisan build:components # builds the component libraries
npx artisan build:functions # builds the function library
npx artisan build:types # builds all types

# when deploying to Vercel, Netlify, or GitHub Pages
npx artisan build:playground 
npx artisan build:docs

npx artisan example # select to run one of examples (follow CLI prompts)

# test your stack
npx artisan test # runs test suite
npx artisan test:unit # runs unit tests
npx artisan test:e2e # runs e2e tests
```

</details>

Read more here about the Stacks CLI in the documentation.

## 📚 Utilizing the Built Libraries

Because we optimize toward the development of easily reusable & composable component & function libraries, our primary intention is to always _keep it simple, yet configurable._

By default, Stacks bundles your components into several outputs. Web Component (Custom Elements) & Vue Component Libraries are automatically generated, amongst other packages.

<details>
<summary>A Custom Element example</summary>

```html
<html>
  <body>
    <hello-world name="Jane Doe"></hello-world>
    <script src="hello-world-elements.js"></script>
  </body>
</html>
```
</details>

<details>
<summary>A Vue 2 & 3 example</summary>

```vue
<script setup lang="ts">
import HelloWorld from 'hello-world-vue'
</script>

<template>
  <HelloWorld name="J Doe" />
</template>
```
</details>

You may view this framework as an incredibly "useful set of frames" to assist in efficiently bootstrapping, designing, and managing component libraries—using industry best-practices, to reach one of the broadest user bases possible.

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
