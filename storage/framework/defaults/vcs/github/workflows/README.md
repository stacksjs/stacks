# GitHub Actions

This folder contains the following GitHub Actions:

- [CI][CI] — all CI jobs for the project
  - lints the code
  - `typecheck`s the code
  - runs the test suite
  - runs on `ubuntu-latest`
- [Release][Release] — on a `v*` tag, generates the changelog and creates the GitHub release
- [Labeler][Labeler] — labels pull requests from `.github/labeler.yml`

[CI]: ./ci.yml
[Release]: ./release.yml
[Labeler]: ./labeler.yml
