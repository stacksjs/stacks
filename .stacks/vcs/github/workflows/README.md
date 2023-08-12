# GitHub Actions

This folder contains the following GitHub Actions:

- [CI][CI] - all CI jobs for the project
  - lints the code
  - `typecheck`s the code
  - automatically fixes & applies code style updates
  - runs tests (unit, end-to-end)
  - runs on `ubuntu-latest` with `bun-versions` set to `[x]`
- [Release][Release] - automates the release process & changelog generation
- [Lock Closed Issues][Lock Closed Issues] - Locks all closed issues after 14 days of being closed

[CI]: ./workflows/ci.yml
[Release]: ./workflows/release.yml
[Lock Closed Issues]: ./workflows/lock-closed-issues.yml
