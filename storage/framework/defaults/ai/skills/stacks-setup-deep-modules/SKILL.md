---
name: stacks-setup-deep-modules
description: Configure and prove public-entrypoint, test-fixture, and dependency-cycle rules for TypeScript packages in Stacks.
disable-model-invocation: true
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Set up deep modules

The Stacks-native counterpart to Matt Pocock's `setup-ts-deep-modules` workflow.
Read `stacks-codebase-design` and [the adaptation rules](../stacks-flow/ENGINEERING.md).
Source and MIT attribution are in [NOTICE.md](NOTICE.md) and [LICENSE](LICENSE).
The source workflow is in progress upstream.

## Discover the actual surface

Read the package manifests, export maps, TypeScript aliases, existing boundary
checks, and CI. Framework packages live under `storage/framework/core/`; app
modules use the project's established layout. Do not create `src/packages`
or assume every root file is public when a package has an explicit export map.

Record public entrypoints, implementation paths, test fixtures, and exceptions.
Preserve intentional subpath exports and development-condition resolution.
Use the smallest check that can express the actual boundary.

## Rules to enforce

- Callers outside a package use its public entrypoints or declared subpaths.
- Implementation files within a package can import each other.
- Tests exercise public behavior and can import their own fixtures. Internal
  tests need an explicitly documented seam, not a blanket deep-import exemption.
- Dependency cycles fail where the project forbids them. Inspect existing
  intentional cycles before adding a rule that breaks the whole repository.

Honor the project's current tool if it already enforces these rules. Otherwise
write a TypeScript check run by Bun using resolved import paths and the real
export maps. A regex over import strings alone cannot establish resolved
package ownership or detect every import form. If dependency-cruiser is
already installed or explicitly requested, verify its current configuration
API before extending it. Preserve existing rules and better-dx dependencies.

## Prove the check

Wire the check into the existing quality command or CI. Use a temporary fixture
to observe a clean pass, a failure for an outside deep import, and a clean pass
after removing it. Repeat for a disallowed test import and a cycle. Keep these
checks as focused regression tests when adding a new checker. Clean up temporary
violations and verify the repository's intended exports remain usable.

Document the real convention beside the packages and add a pointer in canonical
`AGENTS.md`. Completion means the demonstrated violations fail deterministically
and the current valid surface passes. A request to set up checks does not
authorize unrelated package moves, a commit, or a new example package.
