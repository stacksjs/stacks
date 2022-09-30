# Contributing

First off, thank you for taking the time to contribute to Open Web ❤️

## 💭 Knowledge

### TypeScript

It's important to note early on that these projects are written with [TypeScript][typescript]. If you're unfamiliar with it or any strongly typed languages such as Java then this may be a slight roadblock. However, there's never a truly perfect time to start learning it, so ... why not today!

Don't be discouraged, because you likely will get by learning TypeScript on-the-fly as you view some of the component examples within the codebase. It's easy getting started—the code is very readable!

### Stacks

This project uses Stacks as its framework/engine. Under the hood, it is powered by [Vue][vue] & [Vite][vite] to build [Vue components][vue-components], Web Components, and "composable functions".

### Architecture

An understanding of the library architecture and design will help if you're looking to contribute long-term, or you are working on a big PR. Browse the source and read our documentation to get a better idea on how it is structured. Feel free to ask any question _(Twitter, Discord, or GitHub Discussions)_, we would love to elaborate.

## 🎒 Getting Started

### Install

Please view the README and the instructions below on how to install the project locally.

### Project Setup

**Working on your first Pull Request?** You can learn how from this free series [How to Contribute to an Open Source Project on GitHub][pr-beginner-series].

Head over to the [repository][stacks] on GitHub and click the Fork button in the top right corner. After the project has been forked, run the following commands in your terminal:

```bash
# Replace {github-username} with your GitHub username.
git clone https://github.com/{github-username}/stacks --depth=1

cd stacks

# Create a branch for your PR, replace {issue-no} with the GitHub issue number.
git checkout -b issue-{issue-no}
```

Now it'll help if we keep our `main` branch pointing at the original repository and make
pull requests from the forked branch.

```bash
# Add the original repository as a "remote" called "upstream".
git remote add upstream git@github.com:stacksjs/stacks.git

# Fetch the git information from the remote.
git fetch upstream

# Set your local main branch to use the upstream main branch whenever you run `git pull`.
git branch --set-upstream-to=upstream/main main

# Run this when we want to update our version of main.
git pull
```

## Artisan Toolkit

The following list is of some of the most common ways to interact with the Stacks API. Meet Artisan:

```bash
pnpm artisan install # installs all dependencies
pnpm artisan dev # starts one of the dev servers (components, functions, pages, or docs)
pnpm artisan build # follow CLI prompts to select which library (or server) to build
pnpm artisan commit # follow CLI prompts for committing changes
pnpm artisan release # creates the releases for the stack & consequently, publishes them to npm

pnpm artisan make:component HelloWorld # bootstraps a HelloWorld component
pnpm artisan make:function HelloWorld # bootstraps a HelloWorld function
pnpm artisan make:page hello-world # bootstraps a HelloWorld page (https://127.0.0.1/hello-world)

pnpm artisan help
```

<details>
<summary>View the complete Artisan Toolkit</summary>

```bash
pnpm artisan # view help menu
pnpm artisan install # installs your dependencies
pnpm artisan fresh # fresh reinstall of all deps
pnpm artisan update # auto-update deps & the Stacks framework

pnpm artisan --version # get the Stacks version
pnpm artisan --help # view help menu

# if you need any more info to any command listed here, you may suffix
# any of them via the "help option", i.e. `pnpm artisan ... --help`

pnpm artisan dev # starts one of the dev servers (components, functions, pages, or docs)
pnpm artisan dev:components # starts local playground dev server
pnpm artisan dev:pages # starts local playground pages dev server
pnpm artisan dev:functions # stubs local the functions
pnpm artisan dev:docs # starts local docs dev server

# for Laravel users, `serve` may be a more familiar command. Hence, we aliased it:
pnpm artisan serve # starts one of the dev servers (components, functions, pages, or docs)
pnpm artisan serve:components # starts local playground dev server
pnpm artisan serve:pages # starts local playground pages dev server
pnpm artisan serve:functions # stubs local the functions
pnpm artisan serve:docs # starts local docs dev server

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

# building for production (e.g. npm, Vercel, Netlify, et al.)
pnpm artisan build # select a specific build (follow CLI prompts)
pnpm artisan build:components # builds Vue component library & Web Component library
pnpm artisan build:functions # builds function library
pnpm artisan build:vue-components # builds Vue 2 & 3-ready Component library
pnpm artisan build:web-components # builds framework agnostic Web Component library (i.e. Custom Elements)
pnpm artisan build:pages # builds pages

# when deploying your app/s
pnpm artisan deploy:docs
pnpm artisan deploy:functions
pnpm artisan deploy:pages

# select the example to run (follow CLI prompts)
pnpm artisan example

# test your stack
pnpm artisan test # runs test suite
pnpm artisan test:unit # runs unit tests
pnpm artisan test:e2e # runs e2e tests
pnpm artisan test:coverage # runs test coverage
pnpm artisan test:types # runs typecheck
```

</details>

## 🧪 Test

### Unit

Each of our components come with test cases. Feel free to check them out within the `./tests` root folder. When adding or or updating functionality, please ensure it is covered through our tests cases. Ensure so by running `pnpm test`.

## ✍️ Commit

This project uses [semantic commit messages][semantic-commit-style] to automate package releases. We automated the commit process for you, and simply run `pnpm run commit` in your terminal and follow the instructions.

For example,

```bash
# Add all changes to staging to be committed.
git add .

# Commit changes.
pnpm run commit

# Push changes up to GitHub.
git push
```

## 🎉 Pull Request

When you're all done, head over to the [repository][stacks], and click the big green
`Compare & Pull Request` button that should appear after you've pushed changes to your fork.

Don't expect your PR to be accepted immediately or even accepted at all. Give the community time to
vet it and see if it should be merged. Please don't be disheartened if it's not accepted. Your
contribution is appreciated more than you can imagine, and even a failed PR can teach us a lot ❤️

[typescript]: https://www.typescriptlang.org
[vue]: https://vuejs.org/
[vite]: https://vitejs.dev/
[vue-components]: https://vuejs.org/guide/essentials/component-basics.html
[stacks]: https://github.com/stacksjs/stacks
[semantic-commit-style]: https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716
[pr-beginner-series]: https://app.egghead.io/courses/how-to-contribute-to-an-open-source-project-on-github
