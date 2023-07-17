![Social Card of Stacks](./art/social.png)

# Rapid App Development

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![npm downloads][npm-downloads-src]][npm-downloads-href]
<!-- [![Codecov][codecov-src]][codecov-href] -->

_Beta coming soon._

The goal of the framework is to _help you_ create & maintain frontends, backends, and clouds—without having to worry about the boilerplate. Stacks is a rapid application development framework, meeting all your full stack needs.

- Web & Desktop applications
- Serverless & traditional APIs
- Cloud infrastructure creation & maintenance
- Interactive CLIs
- Framework-agnostic component & function libraries
- Deployment & Release Manager _(CI & CD)_

Stacks helps you every step along the way—in beginner & expert-friendly ways, allowing you to focus on the _what_ and _why_ of your project.

> “Convention over configuration” is the Stacks mantra. _- Chris_

<!-- ![Atomic UI & FX Design](./docs/images/diagram.png) -->

## Features

The Stacks framework is a harmony of several “engines” to build any web and/or desktop application, in highly scalable & privacy-friendly ways. It consists of the following engines:

### Stacks UI

_Develop dynamic UIs with helpers for atomic design, and much more._

- 🧩 **Components** _a primitive to develop user interfaces_
- 🤖 **Functions** _a primitive to develop business logic (and grant your UI superpowers)_
- 🌐 **Web** _"a routing & templating engine that makes sense" using components—SSG & PWA ready_
- 🖥️ **Desktop** _components as desktop elements_
- 📚 **Library** _auto-builds component & function libraries_
- ⚡️ Powered by Nitro, Tauri, UnoCSS, Vite & Vue

### Stacks Functions

_Develop serverless (or server) functions with countless helpers to build scalable & fast APIs._

- 🪄 **AI** _deep OpenAI integration_
- 🤖 **APIs** _scalability & maintainability built-in_
- 🏎️ **Cache** _Redis, DynamoDB, Upstash, SingleStore, and more—serverless_
- ⚙️ **CLIs** _create beautiful CLIs for Linux, Windows, and Mac—without requirements_
- 📀 **Database** _MySQL, Postgres, PlanetScale, Supabase, Prisma, ..._
- 👾 **Errors** _native type-safe error handling_
- 🗓️ **Events** _functional event (front & backend) communication_
- 📢 **Notifications** _emails, SMSs, direct, and push notifications & webhooks_
- 🗺️ **ORM** _supercharged, fully-typed models & relations (including automated migrations)_
- 💳 **Payments** _unified API for one-off & subscription billing methods for Stripe_
- ⚙️ **Queues** _run any heavy workload in the background_
- 🛠️ **Query Builder** _powerful, type-safe SQL query builder_
- 💬 **Realtime** _“everything you need to build dynamic real-time apps”_
- 🧭 **Router** _smart routing, file-based or Laravel-like_
- 🔎 **Search Engine** _smart searching, advanced filtering & sorting, pagination, headless UI_
- 💾 **Storage** _easily create & make use of local & remote storages/file systems_
- 🧪 **Tinker** _a powerful TypeScript REPL_
- 🌪️ **Validation** _e2e type-safety (true frontend & backend harmony)_
- 🎯 **X-Ray** _all you need to debug, log & analyze_

### Stacks Cloud

_Create your personal or professional Vercel-like cloud, based on MIT-licensed OSS._

- ☁️ **Server** _local development server & production-ready servers_
- ⛅️ **Serverless** _on-demand, auto-scaling, zero maintenance_
- 🚏 **CDN** _zero-config low-latency CDN, including request life-cycle hooks & optimized request compressions (Brotli & gzip)_
- 🔀 **Domain** _version-controlled & zero-config domain management (e.g. DNS management)_
- 📧 **Email** _secure & simplistic easy-peasy@custom-domains.com mail_
- 🔐 **Firewall** _native web application firewall support_
- 🚜 **Maintenance** _maintain your cloud infrastructure with ease using Buddy & Stacks_
- 🤖 **Infrastructure as Code** _version-controlled cloud infrastructure_

### Stacks CI/CD

_Focus on coding, not publishing._

- 🚀 **Deployment Manager** _take the sweat out of production deployments (AWS, Vercel, Netlify, and more)_
- 📫 **Release Manager** _libraries (component & function) auto-published to npm, git helpers, and more_

### Stacks DX

_Enhanced productivity for developers. No more creating boilerplate._

- 💡 **IDE Integration** _auto-completions, inline docs & a powerful VS Code setup_
- 🪄 **Zero-Config** _yet highly configurable—convention over configuration_
- 👩🏽‍🔧 **Linter & Formatter** _auto-configured & built into your IDE_
- 💪🏼 **Type Strong** _built-in e2e type-safety_
- ✨ **Git Workflows** _committing with ease_
- 🚗 **Auto Imports** _your components & functions, including date, string, array, & object helpers_
- ⏩ **Code Snippets** _say goodbye to the boilerplate—thank you Sarah Drasner_
- 🔤 **Spell Checker** _be notified once there are typos_
- 🛠️ **Utilities** _Collections, VueUse, and more_
- 🧪 **Testing** _unit & e2e tests powered by Bun & Playwright_

No matter whether you are a beginner or an expert, the approachable Stacks design allows you to learn at your own pace, using our thorough documentation covering every aspect of the framework. Stacks is extremely beginner & expert-friendly.

Develop beautiful, reactive, composable UIs without learning a new set of languages. HTML, CSS, and minimal JavaScript—that's all you need to dive in now! _Or TypeScript ✌🏼_

> _A true rapid application development framework for all Full Stack needs. Next-level simplicity & helpful DX._

## Get Started

It's incredibly easy to get started with this framework. Simply run the following command in your terminal:

```bash
sh <(curl stacksjs.dev) my-project

# alternatively, if Node.js >= v18.16 is installed already,
# you may also get started via:
bunx stacks new my-project
```

## 🤖 Usage

The following list includes some of the most common ways to interact with the Stacks API. Meet the toolkit, Buddy:

```bash
buddy install # installs all dependencies
buddy dev # starts one of the dev servers (components, functions, views, or docs)
buddy build # follow CLI prompts to select which library (or server) to build
buddy commit # follow CLI prompts for committing changes
buddy release # creates the releases for the stack & consequently, publishes them to npm
buddy upgrade # auto-update all deps & the Stacks framework

buddy make:component HelloWorld # scaffolds a component
buddy make:function HelloWorld # scaffolds a function
buddy make:page hello-world # scaffolds a page (https://my-project.test/hello-world)

buddy --help
```

<details>
<summary>View the complete Buddy Toolkit</summary>

```bash
buddy --version # get the Stacks version
buddy --help # view help menu
# please note: you may suffix any command with the
# `command --help` flag to review the help menu

buddy install # installs dependencies
buddy add # adds a stack or dependency
buddy fresh # fresh reinstall of all deps
buddy clean # removes all deps

buddy upgrade # auto-upgrades deps, framework, node.js, and/or pnpm
buddy upgrade:dependencies # auto-upgrades deps & the Stacks framework
buddy upgrade:framework # auto-upgrades deps & the Stacks framework
buddy upgrade:search-engine # auto-upgrades configured search engine
buddy upgrade:bun # upgrades to latest project-defined Bun version
buddy upgrade:all # upgrades Node, package manager, framework, dependencies

# if you need any more info on any command listed here, you may suffix
# any of them via the "help option", i.e. `buddy ... --help`

buddy dev # starts one of the dev servers (components, functions, views, or docs)
buddy dev:components # starts local playground dev server
buddy dev:desktop # starts the Desktop playground
buddy dev:views # starts local playground views dev server
buddy dev:functions # stubs local the functions
buddy dev:docs # starts local docs dev server
buddy development # `buddy dev` alias

# for Laravel folks, `serve` may ring more familiar than the `dev` name. Hence, we aliased it:
buddy serve
buddy serve:components
buddy serve:desktop
buddy serve:views
buddy serve:functions
buddy serve:docs

# building for production (e.g. AWS, Google Cloud, npm, Vercel, Netlify, et al.)
buddy build # select a specific build (follow CLI prompts)
buddy build:views # builds SSG views
buddy build:desktop # builds Desktop application
buddy build:library # builds any or all libraries
buddy build:functions # builds function library
buddy build:components # builds Vue component library & Web Component library
buddy build:web-components # builds framework agnostic Web Component library (i.e. Custom Elements)
buddy build:vue-components # builds Vue 2 & 3-ready Component library
buddy build:all # builds all your code

# `buddy build` aliases
buddy prod
buddy prod:components
buddy prod:desktop
buddy prod:library
buddy prod:views
buddy prod:functions
buddy prod:vue-components
buddy prod:web-components
buddy prod:all
buddy production # `buddy prod` alias

# sets your application key
buddy key:generate

buddy make:component HelloWorld # bootstraps a HelloWorld component
buddy make:function hello-world # bootstraps a hello-world function
buddy make:page hello-world # bootstraps a hello-word page
buddy make:model Car # bootstraps a Car model
buddy make:database cars # creates a cars database
buddy make:migration create_cars_table # creates a cars migration file
buddy make:factory cars # creates a Car factory file
buddy make:seed cars # creates a Car seed file
buddy make:table cars # boostraps a cars data table
buddy make:notification welcome-email # bootstraps a welcome-email notification
buddy make:lang de # bootstraps a lang/de.yml language file
buddy make:stack my-project # shares logic with `bunx stacks new my-project`

buddy lint # runs linter
buddy lint:fix # runs linter and fixes issues

buddy commit # follow CLI prompts for committing staged changes
buddy release # creates the releases for the stack & triggers the Release Action (workflow)
buddy changelog # generates CHANGELOG.md

# when deploying your app/s to a remote server or cloud provider
buddy deploy # select a specific deployment (follow CLI prompts)
buddy deploy:docs # deploys docs to AWS (or other configured provider)
buddy deploy:functions # deploys functions to AWS (or other configured provider)
buddy deploy:views # deploys views to AWS (or other configured provider)
buddy deploy:all # deploys all your code

# select the example to run (follow CLI prompts)
buddy example # prompts you to select which example to run
buddy example:vue # runs the Vue example
buddy example:web-components # runs the Web Component example

# you likely won't need to run these commands as they are auto-triggered, but they are available
buddy generate  # prompts you to select which generator to run
buddy generate:entries # generates entry files for components, functions, & views
buddy generate:vue-compat # generates Vue 2 compatibility layer
buddy generate:web-types # generates Web Component types
buddy generate:vscode-custom-data # generates VSCode custom data
buddy generate:ide-helpers # generates IDE helpers
buddy generate:component-meta # generates component meta
buddy generate:all # runs all generators

# generates your application key
buddy key:generate # generates your application key

# generate your TypeScript declarations
buddy types:generate # generates types for your components, functions, & views
buddy types:fix # auto-fixes types for your components, functions, & views

# test your stack
buddy test # runs test suite (unit & e2e)
buddy test:coverage # runs test coverage
buddy test:types # runs typecheck

# the CLI may be triggered in any
# of the following syntax:
stx fresh
buddy fresh
bud fresh
buddy fresh
```

</details>

Read more here about the Stacks CLI in the documentation.

## 📚 Utilizing the Built Libraries

Because Stacks optimizes the development of easily reusable & composable component & function libraries, the primary intention is to always _keep it simple, yet configurable._

By default, Stacks realizes whether your Stack includes components, functions, and/or views. Based on that determination, Stacks builds your outputs.

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

You may view this framework as an incredibly “useful set of frames” to assist in efficiently bootstrapping, designing, and managing component & function libraries—using industry best practices, to reach one of the broadest user bases possible.

## 🎯 Roadmap

Part of the Stacks ecosystem are the following first-party supported stacks:

- [Table](https://github.com/stacksjs/stacks/tree/main/.stacks/stacks/tables) (Data tables with ease)
- [Calendar](https://github.com/stacksjs/calendar) (Add to Calendar utilities—iCal, Google, and more)
- [Command Palette](https://github.com/stacksjs/command-palette) (`⌘ + k` for the web)
- [Date Picker](https://github.com/stacksjs/date-picker) (Beautiful, modern date picker)
- [File Manager](https://github.com/stacksjs/file-manager) (Build your own file manager—like Dropbox or Google Drive)
- [Image](https://github.com/stacksjs/image) (Modern image experience)
- [Video](https://github.com/stacksjs/video) (Modern video experience)
- [Audio](https://github.com/stacksjs/audio) (Modern audio experience)
- [Identity](https://github.com/stacksjs/identity) (Identity providers & wallet integrations)
- [Digital Ownership](https://github.com/stacksjs/ownership) (Public ownership protocol integrations)
- [Payments](https://github.com/stacksjs/payments) (Unified payment APIs)
- [Governance](https://github.com/stacksjs/governance) (Powerful toolkit for democratic governance)

View our detailed roadmap/s [here](https://github.com/stacksjs/stacks/projects?query=is%3Aopen), for more information. Additionally, you may find interesting stacks, information & examples over at [Awesome Stacks](https://github.com/stacksjs/awesome-stacks).

## 🧪 Testing

```bash
pnpm test
```

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## 🚜 Contributing

Please see the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.ow3.org)

## 📄 Sponsors

Once we launch a usable Stacks version, we hope people will start enjoying it! Coming soon.

## 🙏🏼 Credits

Many thanks to the following core technologies & people who have contributed to this package:

- [Chris Breuer](https://github.com/chrisbbreuer)
- [Dan Scanlon](https://twitter.com/danscan) _many thanks for donating the `stacks` name on npm_
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](LICENSE.md) for more information.

Made with ❤️

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/stacks?style=flat-square
[npm-version-href]: https://npmjs.com/package/stacks

[npm-downloads-src]: https://img.shields.io/npm/dm/stacks?style=flat-square
[npm-downloads-href]: https://npmjs.com/package/stacks

[github-actions-src]: https://img.shields.io/github/actions/workflow/status/stacksjs/stacks/ci.yml?style=flat-square&branch=main
[github-actions-href]: https://github.com/stacksjs/stacks/actions?query=workflow%3Aci

<!-- [codecov-src]: https://img.shields.io/codecov/c/gh/stacksjs/stacks/main?style=flat-square
[codecov-href]: https://codecov.io/gh/stacksjs/buddy -->
