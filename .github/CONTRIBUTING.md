# Contributing

First off, thank you for taking the time to contribute to the Open Web Foundation ❤️

## 💭 Knowledge

### TypeScript

It's important to note early on that this project is written with [TypeScript][typescript]. If you're unfamiliar with it or any strongly typed languages such as Java then this may be a slight roadblock. However, there's never a truly perfect time to start learning it, so ... why not today!

Don't be discouraged, because you likely will get by and learning TypeScript on the fly as you view some of the component examples within the codebase.

### Vue 3.2 & Vite & unbuild

This project uses [Vue][vue], [Vite][vite] and [unbuild][unbuild] to build [Vue components][vue-components], Web Components, and "composable functions".

### Architecture

An understanding of the library architecture and design will help if you're looking to contribute long-term, or you are working on a big PR. Browse the source and read our documentation to get a better idea on how it is structured. Feel free to ask any question, we would love to elaborate.

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
git remote add upstream git@github.com:ow3org/stacks.git

# Fetch the git information from the remote.
git fetch upstream

# Set your local main branch to use the upstream main branch whenever you run `git pull`.
git branch --set-upstream-to=upstream/main main

# Run this when we want to update our version of main.
git pull
```

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
[unbuild]: https://github.com/unjs/unbuild
[vitebook]: https://vitebook.dev/
[vue-components]: https://vuejs.org/guide/essentials/component-basics.html
[stacks]: https://github.com/ow3org/stacks
[semantic-commit-style]: https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716
[pr-beginner-series]: https://app.egghead.io/courses/how-to-contribute-to-an-open-source-project-on-github
