# GitHub Actions

This folder contains the following GitHub Actions:

- [CI][CI] - all CI jobs for the project
  — lints the code
  — `typecheck`s the code
  - automatically fixes & applies code style updates
  - runs tests (unit, end-to-end)
  - runs on `ubuntu-latest` with `node-versions` set to `[16x, 18x]`
- [Release][Release] - automates the release process & changelog generation

[CI]: ./workflows/ci.yml
[Release]: ./workflows/release.yml
