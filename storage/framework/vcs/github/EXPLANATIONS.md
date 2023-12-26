# CI/CD Configurations

This folder contains GitHub configurations for the project, including the following features:

- GitHub Actions (./workflows)
  - [CI][CI] - all CI jobs for the project
    - Lints the code
    - `typecheck`s the code
    - Auto fixes & applies code style updates via a PR
    - Runs tests (unit & end-to-end)
    - Runs on `ubuntu-latest` with `node-versions` set to `[18x]`
  - [Release][Release] - automates the release process & changelog generation
- [Stale][Stale] - Automates managing stale GitHub issues
- Renovate
  - automatically updates all the dependencies listed in all package.json files throughout the monorepo

Aside from these implemented features, this folder also contains the issue templates used to create new GitHub issues.

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## 📄 License

The MIT License (MIT). Please see [LICENSE](../LICENSE.md) for more information.

Made with 💙

[CI]: ./workflows/ci.yml
[Release]: ./workflows/release.yml
[Stale]: ./stale.yml
