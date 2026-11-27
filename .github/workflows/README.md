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

## Staged npm releases with trusted publishing

The npm trusted publisher for each scoped framework package needs both direct
publishing and dist-tag management. Configure `stacksjs/stacks` and `release.yml`
with the environment field empty because the publication job has no GitHub
environment. The `staging` dist-tag applies to a public version, so grant
`createPackage` and `manageDistTags` on the same publisher configuration.

Before tagging a release, a package maintainer reads the
[npm trusted publisher configuration API](https://api-docs.npmjs.com/) for each
scoped package with their authenticated npm session and 2FA. Save each raw
`GET /-/package/{package}/trust` JSON response as `<encoded name>.json` in a
private working directory. Save `@stacksjs/buddy` as `%40stacksjs%2Fbuddy.json`.
The release script can list the scoped packages with
`bun --config=/dev/null .github/scripts/promote-latest.ts --dry-run`.

Run the audit from the release checkout, passing the version without the `v`
prefix. Set the GitHub repository variable to the generated JSON before tagging.

```sh
bun --config=/dev/null .github/scripts/promote-latest.ts \
  --record-oidc-permissions "$trust_responses" "$version" > npm-permissions.json
gh variable set RELEASE_NPM_OIDC_PERMISSIONS --repo stacksjs/stacks < npm-permissions.json
```

The variable contains the release version and audited package names. Keep npm
session tokens, OTP codes and raw trust API responses out of GitHub. Refresh the
audit for the next release and after changes to a publisher configuration.
The configured release fails before uploading if its audit is incomplete or
any scoped package rejects the job's GitHub identity. When this variable is
absent, the workflow uses its existing npm publication mode.

To resume a failed promotion, keep the same release tag and audit, then rerun
the failed jobs on the original Releaser run. The resume check compares accepted
public archives against the original upload receipts. Verified uploads are
skipped before invoking Pantry. The release obtains fresh OIDC credentials, confirms the
scoped archives, and reapplies `latest` to the same versions. After it can read
every scoped `latest` tag, it publishes the unscoped `stacks` package. The clean
project install runs after verifying the unscoped `latest` tag. Resume the
earlier release before starting a newer release if the tag cohort is partial.
