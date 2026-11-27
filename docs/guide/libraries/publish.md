---
title: Publishing Libraries
description: "Release configured libraries through Buddy, exact source CI and retained original archives."
---

# Publishing libraries

Use `buddy release` for packages declared in `config/library.ts`. Native CI builds,
checks and packs those packages once. The tag workflow publishes the retained
archives and verifies the registry's actual bytes and distribution tags before
creating the standard GitHub release.

## Configure the packages

```ts
export default {
  repository: 'your-org/your-app',
  releaseable: true,
  packages: [
    { name: '@your-org/functions', kind: 'functions', registry: 'npm' },
    { name: '@your-org/elements', kind: 'web-components', registry: 'npm', version: '2.0.0-alpha.1' },
  ],
  release: {
    publisher: 'bun',
    distTag: 'alpha',
    checks: ['test:packages'],
  },
}
```

`checks` names existing `package.json` scripts. They run after the native build
and before packing. Use them for application-specific package, clean consumer
and browser assertions. The normal lint, type and test jobs must also succeed.
A private package is built when selected but is never retained for publication.
A package's explicit `version` remains independent of the root app version.

Stable packages default to the `latest` distribution tag. Any prerelease package
requires an explicit non-`latest` `release.distTag`. The root `--preid` flag selects
a version identifier; it does not select a registry distribution channel.

The exact-archive lifecycle supports the npm registry with Bun or npm. Automatic
publisher discovery prefers installed Bun, then npm. An explicit unavailable
publisher fails. Pantry currently accepts directory publication, so an explicit
Pantry publisher or Pantry-bound registry is rejected before a native release
mutates the checkout. Existing `libs:publish` directory publication remains
available separately.

## Release normally

Commit reviewed source changes, integrate the upstream branch, and run:

```bash
./buddy release --dry-run --bump patch
./buddy release --bump patch
```

Without `--bump`, native Buddy collects the version choice first and validates
its distribution channel before delegating to Bump. Noninteractive use requires
`--bump`.

The dry run validates the real configured package versions, checks, source CI
policy and publisher capabilities without generating files, creating a tag or
writing to a provider. The release branch must track the configured source-CI branch (normally
`origin/main`); a feature-branch upstream cannot produce an eligible main CI run.
A local feature branch tracking `origin/main` is supported.

The real command uses the existing Bump lifecycle to
commit, tag and atomically push the app release. Its GitHub release is deferred
until the configured public libraries have verified.

New apps keep library publication disabled (`releaseable: false`) until you
configure your own repository and public npm packages. Local sample builds remain
available. Set `releaseable: true` when enabling publication.

New apps inherit native `.github/workflows/ci.yml` and `release.yml` templates.
Existing apps should adopt those templates through their normal reviewed workflow
update. Set the repository's `NPM_TOKEN` secret for the default publication job;
the token is exposed only to the publisher step. Source acceptance needs only read access to repository Actions and contents.
Restricted npm packages additionally need scoped registry read credentials before
any upload or readback. Native registry verification resolves `NPM_READ_TOKEN`
(preferred) or `NODE_AUTH_TOKEN` only for the canonical npm registry. Historical
readback can use a read-only `NPM_READ_TOKEN`; registry credentials never enter
retained data or receipts. An overridden registry requires an explicitly bound
`readAuth: { registry, token }` input through the native API, and credentials are
never sent across origins or redirects.

After a publisher attempt, Buddy waits within the configured deadline for the
registry to expose the retained archive. The publisher may report an error
after the registry accepts the upload. If readback times out, keep the original
candidate and run `buddy release:readback` on it before attempting publication
again.

The default CI runs jobs named `Lint`, `Typecheck` and `Test`. Test waits for the
first two, prepares the native libraries before tests which consume their built
assets, then uploads the candidate only after the suite succeeds on the configured source
branch. PR and other branch runs build/test normally but cannot retain a publication
candidate (`source_eligible: false`). Applications
without public libraries skip candidate upload and retain ordinary GitHub release
behavior.

If your source workflow differs, declare its actual path, branch and exact job
names:

```ts
release: {
  sourceCi: {
    workflow: '.github/workflows/ci.yml',
    branch: 'main',
    requiredJobs: ['Lint', 'Typecheck', 'Test'],
    timeoutMinutes: 30,
  },
}
```

Matrix jobs need their actual provider names, including suffixes. Missing,
skipped, duplicated or failed required jobs are rejected. Source acceptance waits
up to 30 minutes by default, bounded separately from registry propagation. A
custom timeout must be an integer from 1 to 120; allow matching time in the release
workflow's job timeout.

## Retained evidence and retries

The tag workflow resolves the real Git tag to its commit and accepts only a
successful same-repository, exact-SHA source run with the configured workflow,
branch, event and required jobs. It requires one owned, nonexpired candidate
artifact, validates the provider ZIP's SHA-256 digest and checks the pre-upload
ownership record. It never rebuilds or repacks the candidate for publication.

Before publication, the current verifier rechecks source ownership and compares
the local candidate to the original provider artifact. Existing package versions
are skipped only when the registry serves identical archive bytes under the
requested actual distribution tag. Missing members of a partial release continue;
a conflicting version, missing expected tag or mismatched bytes ends the release.
No overwrite or implicit tag promotion occurs.

Resume the default Release workflow with its existing tag after fixing a transient
failure. Keep the original candidate until publication finishes. Expired or missing
source artifacts require an honest new source CI run; they cannot be replaced by a
local rebuild claiming the old run's identity. Candidate, source acceptance and
registry receipts are attached to the standard GitHub release with immutable
content-derived filenames, as well as retained in Actions.

Registry receipts record `registryOrigin`, package name and version, verified
archive SHA-256 and integrity, and actual distribution tags. Together these
identify the registry and immutable package content. They deliberately omit
opaque archive download URLs: private registries can return credential-bearing
paths and signed queries. The verifier uses the complete same-origin URL only
in memory to fetch and compare the archive bytes; a receipt is provenance,
not a download credential. Dry-run receipts record the configured origin with
`status: 'dry-run'` and do not claim registry verification.

The workflow uses native Buddy phases internally. They are also available for
inspection and recovery:

```bash
./buddy release:prepare --dry-run
./buddy release:accept --historical --tag v1.2.3 --run-id 123456 --directory storage/framework/runtime/library-release-historical
./buddy release:readback --directory storage/framework/runtime/library-release-historical --output receipt.json
```

The `--historical` acquisition flag uses the current repository/source-CI policy
even if current package definitions or publication settings have changed. It
does not bypass exact source ownership, required jobs, expiry or byte checks.

Historical readback executes the current verifier over retained data. The receipt
records source and verifier commits separately. It does not check out historical
source, execute historical scripts or need a publication token. Existing
`release:verify <plan>` consumer-evidence plans keep their existing schema.

## Related guides

- [Release command](/guide/buddy/release)
- [Getting started with libraries](/guide/libraries/get-started)
- [Component libraries](/guide/libraries/components)
- [Function libraries](/guide/libraries/functions)
