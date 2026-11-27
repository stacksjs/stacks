---
title: Release Command
description: "Prepare a version, commit release metadata, and push the tag that starts the release workflow."
---
# Release Command

`buddy release` updates the current project's version and pushes its release
commit and tag. A consumer app releases its own root package. In the Stacks
framework repository, the command releases the core packages together and
updates their lockstep dependencies.

For configured public libraries, the command validates the native release plan
before changing the checkout. Main CI builds, tests and retains the original
archives; the tag workflow accepts exact source CI, publishes those bytes and
attaches verification receipts to the standard GitHub release. See
[publishing libraries](/guide/libraries/publish) for package and CI configuration.

Builds and publishing continue in GitHub Actions after the push. Check the
workflow and the required public artifacts before updating consumers.

## Native workflow credentials

Generated Stacks workflows check declared native acceptance inputs before
building the simulator app. For an actual tagged release, they also check the
signing, upload, verification and cleanup inputs before that build starts.
Credentials remain confined to their declared steps and the short preflight;
the build does not receive signing or deployment credentials.

```bash
./buddy workflow:check-credentials native-accept
./buddy workflow:check-credentials native-release
```

These commands check whether configured values are present, including rejecting
whitespace-only values. They print missing variable names, never values, and
do not establish that a provider will accept the credentials. Native jobs use
the `ios-testflight` environment. Credentials configured only in `production`
are not inherited there; configure shared publication inputs explicitly in
each environment that needs them. Direct `buddy workflow:step` execution also
checks its declared inputs before starting application commands.

After a successful upload, a later screenshot or docs publication failure does
not require another app upload. Preserve the original failed run and its
artifact digests, restore its verified acceptance and upload receipts into the
matching release workspace, configure the missing inputs, then retry the
project's normal `buddy workflow:step native-verify` command. Confirm Apple
tester availability and the published media independently. Keep recovery
results separate from the original CI verdict.

## Usage

Choose the increment explicitly for a non-interactive release:

```bash
./buddy release --dry-run --bump patch
bun run release:patch
```

Without `--bump`, the command prompts for the version. Conventional commits
describe changes and feed the changelog; the command does not automatically
choose a major or minor increment from those messages.

| Option | Purpose |
| --- | --- |
| `--bump <type>` | A Bumpx release type, `calendar`, or an explicit semantic version |
| `--preid <identifier>` | A prerelease version identifier such as `beta` or `rc`; registry channel is `library.release.distTag` |
| `--dry-run` | Preview without committing, tagging or pushing |
| `--skip-github-release` | Push the tag without creating its GitHub release through the command |
| `--verbose` | Show additional details |

```bash
./buddy release --bump minor
./buddy release --bump prerelease --preid beta
./buddy release --bump 1.2.3
```

## Prepare the checkout

Use the declared tools and finish the required lint, type and test checks.
In the framework repository, `buddy test` covers the project test tree;
CI also checks the core packages and actual packed consumers.

Release startup loads environment configuration without booting application
globals or setup commands. Its documentation checks can register model routes
and inspect their metadata without opening the application database. The ORM
acquires its configured connection when a query actually needs it, so running
these checks does not require starting or migrating the application.

Integrate the current remote history and configure the branch's intended
upstream. Review `git status` and commit the source changes before releasing.
The release uses the configured Git identity and pushes its release commit
and tag atomically to the resolved destination.

Buddy checks the intended remote branch and exact release tag before preparing
the release. If another publisher wins the race after preparation, Buddy
retains the proposed commit under the reported `refs/stacks/release-recovery/`
ref and restores the checkout's branch tip. Review the retained commit with
`git show` and the prepared files with `git diff --cached`. If the remote
already has the release tag, use that tag's workflow for publication status.

### Refresh locks without starting the project

When dependency declarations change, regenerate both locks with the pinned
Bun and the published Pantry CLI:

```bash
./pantry/.bin/bun install
pantry install --ignore-scripts --quiet
git diff -- bun.lock pantry.lock
```

Commit the normal manifest and lockfile changes together. The framework
release action uses this metadata-only Pantry invocation.

The framework root pins its development `@stacksjs/stx`,
`@stacksjs/components` and `bun-plugin-stx` to one validated public release.
Update those three declarations together through the ordinary installer,
then verify the frozen install and packed consumer checks. A runtime update
alone can leave an older component or compiler in the lockfile. Published
core package ranges describe consumer compatibility separately from this
exact development test set.

A plain `pantry install` also performs configured project setup. That can
start services and run `postDatabaseSetup` or `postSetup` commands, including
migrations and seeding. Use that operation when setting up the project;
use `--ignore-scripts` for a dependency lock refresh.

## Release and publication

The command validates the release state, resolves the requested version,
updates the relevant manifests and changelog, and refreshes framework
lockfiles. It checks those locks before committing the normal release files,
creating the tag and pushing both together.

The [release workflow](https://github.com/stacksjs/stacks/blob/main/.github/workflows/release.yml)
defines the build, publishing and registry authentication steps. Consumer
apps use their own workflows; an app tag does not publish the framework.

An accepted upload can still be waiting for public metadata and its tarball.
Preserve that result and verify the original archive's checksum when it
becomes public. Do not upload the same version again or replace its tag to
address propagation delay. Use a workflow's supported recovery only after
checking its behavior for versions already on the registry.

The framework's recovery step keeps the original archive checksums from the
accepted upload. It requires the exact package and version metadata, then
downloads and verifies the complete original tarball before resuming the
normal publisher. HTTP requests and the overall verification wait are bounded.
An incomplete receipt or an unverified archive ends the job.

The npm release checks the current `latest` tags for the framework and the
sample packages before uploading to npm. When a newer release already owns
one of those tags, the job uses `backfill-<version>` for any missing archive
and skips `latest` promotion, VS Code marketplace publication, and the Homebrew
formula update. The same exact-version npm install still has to pass. A
normal release checks `latest` again before each upload or promotion that
could replace it. This protection applies to tags created after the workflow
change. Rerunning an older tag still uses the workflow stored at that tag.

For other failures, resolve the failing command's cause and keep its evidence.
Do not repeat a version bump over partially generated release metadata.

## Calendar versioning

`--bump calendar` (also `calver` or `date`) computes `YYYY.M.N`:

```bash
./buddy release --bump calendar
bun run release:calendar
```

`N` counts releases within the month and resets when the month changes; it is
not the day. If the clock is behind the last release, numbering continues
within that release's month instead of producing a lower version.

The result uses semantic-version syntax without leading zeroes. Switching
from `0.x.y` to a calendar version such as `2026.9.0` moves above the old
version range; plan consumer ranges accordingly.

## Related commands

- [Commit](/guide/buddy/commit)
- [Changelog](/guide/buddy/changelog)
- [Build](/guide/buddy/build)
- [Upgrade](/guide/buddy/upgrade)
