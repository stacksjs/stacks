---
title: Release Command
description: "Prepare a version, commit release metadata, and push the tag that starts the release workflow."
---
# Release Command

`buddy release` updates the current project's version and pushes its release
commit and tag. A consumer app releases its own root package. In the Stacks
framework repository, the command releases the core packages together and
updates their lockstep dependencies.

Builds and publishing continue in GitHub Actions after the push. Check the
workflow and the required public artifacts before updating consumers.

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
| `--preid <identifier>` | A prerelease channel such as `beta` or `rc` |
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

Integrate the current remote history and configure the branch's intended
upstream. Review `git status` and commit the source changes before releasing.
The release uses the configured Git identity and pushes its release commit
and tag atomically to the resolved destination.

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
