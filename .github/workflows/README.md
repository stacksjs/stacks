# GitHub Actions

This folder contains the following GitHub Actions:

- [CI][CI] - all CI jobs for the project
  - lints the code
  - `typecheck`s the code
  - automatically fixes & applies code style updates
  - runs tests (unit, end-to-end)
  - runs on `ubuntu-latest` with `bun-versions` set to `[x]`
- [Release][Release] - automates the release process & changelog generation
- [Idle Memory Benchmark][Idle Memory Benchmark] - records settled framework memory on the weekly and manual diagnostic profile
- [Router Startup Diagnostic][Router Startup Diagnostic] - records paired fresh-process imports and verified HTTP readiness

[CI]: ./ci.yml
[Release]: ./release.yml
[Idle Memory Benchmark]: ./memory-benchmark.yml
[Router Startup Diagnostic]: ./startup-benchmark.yml
