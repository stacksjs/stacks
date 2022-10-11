![Social Card of Stacks](.github/art/social.png)

# Atomic Full Stack

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![npm downloads][npm-downloads-src]][npm-downloads-href]
<!-- [![Codecov][codecov-src]][codecov-href] -->

The goal of the Stacks framework is to _help you_ create & maintain UIs _(pages & components)_ & function _(composables & APIs)_ libraries. The Stacks build system automatically builds highly-composable & scalable, framework-agnostic libraries—in beginner & expert-friendly ways, embodying [Composability-First Design](/apps/site/docs/composability-first-design.md) principles.

![Atomic UI & FX Design](./apps/site/images/diagram.png)

🤖 **Zero-config, by design**

The Stacks framework automagically bundles & builds your code. A Web Component library, Vue 2 & 3 libraries, a composable functions library or API, plus all of its relating type declarations. Out of plain HTML & minimal JavaScript. _The best of the Vite & Nitro engines in a zero-config way._

🎨 **Style with ease**

Create your own style guide using conventions you are familiar with. Stacks' UnoCSS atomic engine allows for just that, in a blazing-fast, on-demand way. Tailwind CSS, Windi CSS, Bootstrap, Tachyons, Heroicons, Material Design Icons, and more to choose from.

**✨ Next-gen Developer Experience _(DX)_**

Whether it is the simplistic artisan setup & maintenance, the toolkit of accessible APIs, modern git commit conventions, a powerful, yet simple, CI, automated npm package releases & semver versioning, pretty changelog generations, automated PR dependency updates, built-in spell-checking, integrated documentation tooling, or the pre-configured examples... _Stacks has it all._

💡 **First-class VS Code integration**

IDE Capabilities, fully-typed, code completion, automatic web-types & custom HTML data generations, code formatting, and more—all natively built-into Stacks _And without the need for Prettier._

🧙🏼‍♀️ **Extremely beginner & expert-friendly**

No matter whether you are a beginner or an expert, the approachable Stacks design allows you to learn at your own pace, using our thorough documentation covering every aspect of the framework.

Develop beautiful, reactive, composable UIs & functions without learning a new set of languages. HTML, CSS, and minimal JavaScript—that's all you need to dive in now! _(Or TypeScript ✌🏼)_

> _The clever way to build & share component & function libraries (and servers!)._

## Get Started

It's incredibly easy to get started with this framework. Simply run the following command in your terminal:

```bash
curl -fsSL https://stacksjs.dev/setup | sh

# alternatively, if you know your setup is ready, install a new stack via:
npx artisan-init my-project
```

> **Note**
> Node.js v18.10 & pnpm 7.13 or higher required. _Artisan will set you up._

## 🤖 Usage

Meet the Artisan Toolkit. The following list is of some of the most common ways to interact with the Stacks API:

```bash
pnpm artisan install # installs all dependencies
pnpm artisan dev # starts one of the dev servers (components, functions, pages, or docs)
pnpm artisan build # follow CLI prompts to select which library (or server) to build
pnpm artisan commit # follow CLI prompts for committing changes
pnpm artisan release # creates the releases for the stack & consequently, publishes them to npm

pnpm artisan make:component HelloWorld # scaffolds a component
pnpm artisan make:function HelloWorld # scaffolds a function
pnpm artisan make:page hello-world # scaffolds a page (https://127.0.0.1/hello-world)

pnpm artisan --help
```

<details>
<summary>View the complete Stacks Artisan Toolkit</summary>

```bash
pnpm artisan --help # view help menu
pnpm artisan install # installs your dependencies
pnpm artisan fresh # fresh reinstall of all deps
pnpm artisan update # auto-update deps & the Stacks framework

pnpm artisan --version # get the Stacks version
pnpm artisan --help # view help menu

# if you need any more info on any command listed here, you may suffix
# any of them via the "help option", i.e. `pnpm artisan ... --help`

pnpm artisan dev # start one of the dev servers (components, functions, pages, or docs)
pnpm artisan dev:components # start local playground dev server
pnpm artisan dev:pages # start local playground pages dev server
pnpm artisan dev:functions # stub local the functions
pnpm artisan dev:docs # start local docs dev server

# for Laravel users, `serve` may be a more familiar command. Hence, we aliased it:
pnpm artisan serve # start one of the dev servers (components, functions, pages, or docs)
pnpm artisan serve:components # start local playground dev server
pnpm artisan serve:pages # start local playground pages dev server
pnpm artisan serve:functions # stub local the functions
pnpm artisan serve:docs # start local docs dev server

# building for production (e.g. npm, Vercel, Netlify, et al.)
pnpm artisan build # select a specific build (follow CLI prompts)
pnpm artisan build:components # build Vue component library & Web Component library
pnpm artisan build:functions # build function library
pnpm artisan build:vue-components # build Vue 2 & 3-ready Component library
pnpm artisan build:web-components # build framework agnostic Web Component library (i.e. Custom Elements)
pnpm artisan build:pages # build SSG pages

# sets your application key
pnpm artisan key:generate

pnpm artisan make:stack project
pnpm artisan make:component HelloWorld
pnpm artisan make:function hello-world
pnpm artisan make:page hello-world
pnpm artisan make:lang de
pnpm artisan make:database cars
pnpm artisan make:table brands
pnpm artisan make:migration create_cars_table
pnpm artisan make:factory cars

pnpm artisan stub # stubs all the libraries
pnpm artisan stub:functions # stubs the function library

pnpm artisan lint # runs linter
pnpm artisan lint:fix # runs linter and fixes issues

pnpm artisan commit # follow CLI prompts for committing staged changes
pnpm artisan release # creates the releases for the stack & triggers the Release Action (workflow)
pnpm artisan changelog # generates CHANGELOG.md

# when deploying your app/s to a remote server or cloud provider
pnpm artisan deploy:docs
pnpm artisan deploy:functions
pnpm artisan deploy:pages

# select the example to run (follow CLI prompts)
pnpm artisan example

# you likely won't need to run these commands as they are auto-triggered, but they are available
pnpm artisan generate
pnpm artisan generate:types
pnpm artisan generate:entries
pnpm artisan generate:vue-compat
pnpm artisan generate:web-types
pnpm artisan generate:vscode-custom-data
pnpm artisan generate:ide-helpers

# test your stack
pnpm artisan test # runs test suite
pnpm artisan test:unit # runs unit tests
pnpm artisan test:e2e # runs e2e tests
pnpm artisan test:coverage # runs test coverage
pnpm artisan test:types # runs typecheck
```

</details>

Read more here about the Stacks CLI in the documentation.

## 📚 Utilizing the Built Libraries

Because Stacks optimizes the development of easily reusable & composable component & function libraries, the primary intention is to always _keep it simple, yet configurable._

By default, Stacks realizes whether your Stack includes components, functions, and/or pages. Based on that determination, Stacks builds your outputs.

The UI libraries that automatically get built are: a Web Component (Custom Elements) & Vue Component library.

<details>
<summary>Web Component usage</summary>

```bash
npm install my-awesome-library
```

After you installed your Stacks generated library, you can use a "Custom Element" (Web Component) in the following way:

```html
<html>
  <body>
    <hello-world name="Jane Doe"></hello-world>
    <script src="my-awesome-library.js"></script>
  </body>
</html>
```

</details>

<details>
<summary>Vue 2 & 3 usage</summary>

```bash
npm install my-awesome-library
```

After you installed your Stacks generated library, you can use your Vue Components in the following way:

```vue
<script setup lang="ts">
import HelloWorld from 'my-awesome-library'
</script>

<template>
  <HelloWorld name="J Doe" />
</template>
```

</details>

_A function library may also be automatically generated._

<details>
<summary>Functions usage</summary>

```bash
npm install hello-world-library
```

After you installed your Stacks generated library, you can use your functions in the following way:

```ts
import { count, increment } from 'hello-world-fx'

console.log('count is', count)
increment()
console.log('increased count is', count)
```

</details>

You may view this framework as an incredibly "useful set of frames" to assist in efficiently bootstrapping, designing, and managing component & function libraries—using industry best practices, to reach one of the broadest user bases possible.

## 🚙 Roadmap

Part of the Stacks ecosystem are the following first-party supported stacks:

- [Table](https://github.com/stacksjs/table) (Q3 - Data tables with ease)
- [Calendar](https://github.com/stacksjs/calendar) (Q3 - Add to Calendar utilities—iCal, Google, and more)
- [Command Palette](https://github.com/stacksjs/command-palette) (Q3 - `⌘ + k` for the web)
- [Date Picker](https://github.com/stacksjs/date-picker) (Q3 - Beautiful, modern date picker)
- [File Manager](https://github.com/stacksjs/file-manager) (Q3 - Build your own file manager—like Dropbox or Google Drive)
- [Image](https://github.com/stacksjs/image) (Q3 - Modern image experience)
- [Video](https://github.com/stacksjs/video) (Q3 - Modern video experience)
- [Audio](https://github.com/stacksjs/audio) (Q3 - Modern audio experience)
- [Web3](https://github.com/stacksjs/web3) (Q3 - Solana support, cross-chain core. _Ethereum & Cardano drivers coming._)
  - [Wallets](https://github.com/stacksjs/wallets) (Q3 - Wallet Authentication)
  - [NFT](https://github.com/stacksjs/nft) (Q3 - NFTs, Candy Machine mechanisms, and more.)
  - [DeFi](https://github.com/stacksjs/defi) (Q4 - Cross-chain DeFi engine, including staking support)
  - [DAO](https://github.com/stacksjs/dao) (Q4 - Powerful toolkit for DAO governance)

These stacks make great examples. Find more awesome Stacks [here](https://github.com/stacksjs/awesome-stacks).

## 🧪 Testing

```bash
pnpm test
```

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## 💪🏼 Contributing

Please see [CONTRIBUTING](.github/CONTRIBUTING.md) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Open Web Discord Server](https://discord.ow3.org)

## 📄 Sponsors

Once we launch a usable Stacks version, we hope people will start enjoying it! Coming soon.

## 📄 License

The MIT License (MIT). Please see [LICENSE](LICENSE.md) for more information.

Made with ❤️

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/@stacksjs/stacks?style=flat-square
[npm-version-href]: https://npmjs.com/package/@stacksjs/stacks

[npm-downloads-src]: https://img.shields.io/npm/dm/@stacksjs/stacks?style=flat-square
[npm-downloads-href]: https://npmjs.com/package/@stacksjs/stacks

[github-actions-src]: https://img.shields.io/github/workflow/status/stacksjs/stacks/CI/main?style=flat-square
[github-actions-href]: https://github.com/stacksjs/stacks/actions?query=workflow%3Aci

<!-- [codecov-src]: https://img.shields.io/codecov/c/gh/stacksjs/stacks/main?style=flat-square
[codecov-href]: https://codecov.io/gh/stacksjs/stacks -->
