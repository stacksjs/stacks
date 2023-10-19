<p align="center"><img src="../buddy/art/social.jpg" alt="Social Card of ESLint Config"></p>

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![npm downloads][npm-downloads-src]][npm-downloads-href]
<!-- [![Codecov][codecov-src]][codecov-href] -->

# @stacksjs/eslint-config

Forked from [`@antfu/eslint-config`](https://github.com/antfu/eslint-config)

- Single quotes, no semi
- Auto fix for formatting (aimed to be used as standalone **without** Prettier)
- Designed to work with TypeScript, Vue out-of-box (React opt-in)
- Lint also for json, yaml, markdown
- Sorted imports, dangling commas
- Reasonable defaults, best practices, only one-line of config
- Automatic utility class ordering
- **Style principle**: Minimal for reading, stable for diff

###### Changes in this fork

- Type-Safe error handling
- Improved component library linting & formatting
- Stacks support
- Other minor additions, i.e. `no-constant-binary-expression` usage

## Usage

### Install

```bash
pnpm add -D eslint @stacksjs/eslint-config
```

### Config

Simply create a `.eslintrc` file in your project root with the following content:

```json
{
  "extends": "@stacksjs"
}
```

> Please note, you won't need a `.eslintignore` file as it is pre-defined via this preset.

### ESLint Scripts

Simply add the following to your `package.json`:

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

### VS Code Integration

Install [VS Code ESLint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and create `.vscode/settings.json` to add the following

Add the following settings to your `settings.json`:

```jsonc
{
  "prettier.enable": false,
  "editor.formatOnSave": false,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": false
  },
  // The following is optional.
  // It's better to put under project setting `.vscode/settings.json`
  // to avoid conflicts with working with different eslint configs
  // that does not support all formats.
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact",
    "vue",
    "html",
    "markdown",
    "json",
    "jsonc",
    "yaml"
  ]
}
```

### TypeScript Aware Rules

Type aware rules are enabled when a `tsconfig.eslint.json` is found in the project root, which will introduce some stricter rules into your project. If you want to enable it while have no `tsconfig.eslint.json` in the project root, you can change tsconfig name by modifying `ESLINT_TSCONFIG` env.

```js
// .eslintrc.js
const process = require('node:process')

process.env.ESLINT_TSCONFIG = 'tsconfig.json'

module.exports = {
  extends: '@ow3'
}
```

### Lint Staged

If you want to apply lint and auto-fix before every commit, you can add the following to your `package.json`:

```json
{
  "simple-git-hooks": {
    "pre-commit": "pnpm lint-staged"
  },
  "lint-staged": {
    "*": "eslint --fix"
  }
}
```

and then

```bash
npm i -D lint-staged simple-git-hooks
```

## Badge

If you enjoy this code style, and would like to mention it in your project, here is the badge you can use:

```md
[![code style](https://antfu.me/badge-code-style.svg)](https://github.com/antfu/eslint-config)
```

[![code style](https://antfu.me/badge-code-style.svg)](https://github.com/antfu/eslint-config)

## FAQ

### Prettier?

[Why I don't use Prettier](https://antfu.me/posts/why-not-prettier)

### How to lint CSS?

This config does NOT lint CSS. I personally use [UnoCSS](https://github.com/unocss/unocss) so I don't write CSS. If you still prefer CSS, you can use [stylelint](https://stylelint.io/) for CSS linting.

### I prefer XXX

Sure, you can override the rules in your `.eslintrc` file.

<!-- eslint-skip -->

```jsonc
{
  "extends": "@antfu",
  "rules": {
    // your rules...
  }
}
```

Or you can always fork this repo and make your own.

## Check Also

- [stacksjs/stacks](https://github.com/stacksjs/stacks) - Stacks - The modern way to create & distribute component libraries
- [stacksjs/web-components-starter](https://github.com/stacksjs/web-components-starter) - Starter template for Web Component libraries
- [stacksjs/composable-starter](https://github.com/stacksjs/composable-starter) - Starter template for Composable libraries
- [stacksjs/ts-starter](https://github.com/stacksjs/ts-starter) - Starter template for TypeScript libraries
- [stacksjs/vue-starter](https://github.com/stacksjs/vue-starter) - Starter template for Vue libraries

## 📈 Changelog

Please see our [releases](https://github.com/ow3org/eslint-config/releases) page for more information on what has changed recently.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/ow3org/eslint-config/discussions)

For casual chit-chat with others using this package:

[Join the Open Web Discord Server](https://discord.gg/stacksjs)

## 📄 License

The MIT License (MIT). Please see [LICENSE](LICENSE.md) for more information.

Made with ❤️

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/@stacksjs/eslint-config?style=flat-square
[npm-version-href]: https://npmjs.com/package/@stacksjs/eslint-config

[npm-downloads-src]: https://img.shields.io/npm/dm/@stacksjs/eslint-config?style=flat-square
[npm-downloads-href]: https://npmjs.com/package/@stacksjs/eslint-config

[github-actions-src]: https://img.shields.io/github/actions/workflow/status/ow3org/eslint-config/ci.yml?style=flat-square&branch=main
[github-actions-href]: https://github.com/ow3org/eslint-config/actions?query=workflow%3Aci
