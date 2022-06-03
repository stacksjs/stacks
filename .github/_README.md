# GitHub Configurations

This folder contains GitHub configurations for the project, including these features:

- GitHub Actions (workflows)
  - [CI][CI] — Used to lint the code, run `typecheck`, and ensures both unit & e2e tests pass
  - [Code Style Fixer][Code Style Fixer] - fixes and commits code style updates
  - [Release][Release] - automates the release process & changelog generation. It also
- Renovate
  - automatically updates all the dependencies listed in all package.json files throughout the monorepo

Aside from these implemented features, this folder also contains the issue templates used to create new GitHub issues.

[CI]: ./workflows/ci.yml
[Release]: ./workflows/release.yml
[Code Style Fixer]: ./workflows/code-style-fixer.yml
