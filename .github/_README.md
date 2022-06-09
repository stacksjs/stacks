# GitHub Configurations

This folder contains GitHub configurations for the project, including these features:

- GitHub Actions (workflows)
  - [CI][CI] — Used to lint the code, run `typecheck`, and ensures both unit & e2e tests pass
  - [Code Style Fixer][Code Style Fixer] - fixes and commits code style updates
  - [Release][Release] - automates the release process & changelog generation. It also
- Renovate
  - automatically updates all the dependencies listed in all package.json files throughout the monorepo

Aside from these implemented features, this folder also contains the issue templates used to create new GitHub issues.

## 💪🏼 Contributing

Please see [CONTRIBUTING](./CONTRIBUTING.md) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/openwebstacks/stacks-starter/discussions)

For casual chit-chat with others using this package:

[Join the Open Web Discord Server](https://discord.ow3.org)

## 📄 License

The MIT License (MIT). Please see [LICENSE](../LICENSE.md) for more information.

Made with ❤️

[CI]: ./workflows/ci.yml
[Release]: ./workflows/release.yml
[Code Style Fixer]: ./workflows/code-style-fixer.yml
