# GitHub Actions

This folder contains the following GitHub Actions:

- [CI][CI] — Used to lint the code, run `typecheck`, and ensures both unit & e2e tests pass
- [Code Style Fixer][Code Style Fixer] - fixes and commits code style updates
- [Release][Release] - automates the release process & changelog generation. It also

[CI]: ./workflows/ci.yml
[Release]: ./workflows/release.yml
[Code Style Fixer]: ./workflows/code-style-fixer.yml
