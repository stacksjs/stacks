# Verify source releases before adoption

Run each owning repository's existing `bun run release:patch`, wait for its
required CI and publication jobs, and retain the original archive SHA-512
identities from that release. Install those exact versions with a frozen
lockfile in the consumer. Then run:

```sh
./buddy release:verify release-plan.json --output release-receipt.json
```

This command verifies a release that already exists. It does not bump, tag,
publish, install, or replace an owning repository's release command. The plan
is trusted release policy: choose the actual required workflows and job names,
including publication, and use independently retained archive identities.

```json
{
  "schemaVersion": 1,
  "sources": [{
    "repository": "example/runtime",
    "commit": "1234567890abcdef1234567890abcdef12345678",
    "tag": "v1.2.3",
    "gates": [{
      "runId": 123,
      "workflow": ".github/workflows/release.yml",
      "requiredJobs": ["publish"]
    }],
    "packages": [{
      "name": "@example/runtime",
      "version": "1.2.3",
      "integrity": "COPY THE ORIGINAL sha512- ARCHIVE IDENTITY HERE"
    }]
  }],
  "checks": ["typecheck", "test"]
}
```

The example requires real source, workflow, archive and package identities.
Multiple sources can be verified together, with each installed package assigned
to exactly one owner. Package names refer to the consumer's direct installed
packages and Bun lock entries.

Verification reads the actual tag, the source's `release:patch` script, exact
workflow revisions and required job results. Pending, failed, missing, duplicate
or skipped required jobs block adoption. It then compares npm metadata and
complete downloaded archive bytes with the recorded SHA-512, checks installed
versions and lockfile integrity, compares installed package files with the
archive, and executes the consumer's named package scripts. Source links outside
installed node_modules, extra files, changed code, links and missing files are
rejected. Checks that fail, time out, are cancelled or change the verified
lockfile or package files block the receipt. Nested installed dependencies are
separate package identities; list their owners when they require verification.

Only a complete success writes the receipt, atomically. It records source
revisions, the existing release command, gate identities, package archive
identities, package file-inventory hashes, Bun version, lockfile SHA-256 and
executed check output hashes. Failures have a
nonzero exit code and leave an existing receipt untouched. Successful receipts
are historical evidence; rerun verification after changing a release plan or
consumer installation.

Downloads and gzip expansion have fixed byte budgets and refuse redirects.
Tar entry sizes, types and counts are bounded before parsing file contents.
Packages requiring generated install-time code need separate artifact evidence;
this verifier never treats generated or modified files as published archive bytes.
GitHub
authentication uses the existing token resolution and is never sent to npm.
Check output is hashed instead of copied into the receipt. Library consumers
can set cancellation and tighter budgets through
`@stacksjs/actions/release-evidence`.

Completed checks dispose their normal background descendants before a receipt
is issued. POSIX uses an owned process group and confirms its disappearance.
Windows requires PowerShell with .NET `Add-Type` and `taskkill.exe`; native Job
Objects retain child ownership across intermediate process exits. A command
starts suspended, joins its job, then resumes. Missing ownership support or
failed cleanup blocks verification. This is process cleanup, not a sandbox for
deliberately escaping POSIX groups or privileged external services.

An integrity match proves archive identity against the plan. This command does
not validate registry signatures or SLSA attestations, establish redistribution
rights, prove native execution, or guarantee original-game fidelity. Include
the actual native and product acceptance scripts in the consumer checks and
retain their platform execution evidence separately.

## Retained adoption evidence

The [stx 0.2.644 plan](./receipts/stx-0.2.644-plan.json) and
[executed receipt](./receipts/stx-0.2.644-receipt.json) retain the framework's
adoption of six published stx packages. Original archive identities came from
the successful release's npm job, not from a mutable latest version lookup.
The verifier checked the exact source tag and workflow, downloaded archives,
installed file inventories, Bun lock identities, the lockfile compatibility
check and the framework's stx view type checks.

This is a historical receipt for the recorded lockfile hash. Later framework
releases change that lockfile and need fresh consumer evidence. It establishes
neither native execution nor Settlers III fidelity or original-media rights.

The [DTSX 0.11.20 plan](./receipts/dtsx-0.11.20-plan.json) and
[executed receipt](./receipts/dtsx-0.11.20-receipt.json) retain the framework's
adoption of `@stacksjs/dtsx` and `bun-plugin-dtsx`. This release normalizes initial
source discovery before deduplication. A later Windows framework build exposed
another path spelling introduced by directory re-export resolution. The 0.11.20
receipt does not establish that this complete integration passed. Distinct
flat-output collisions still fail before cleaning the previous declarations.

Original archive identities came from the successful release's npm publication
step. Verification checked the exact tag, source CI including all three OS path
checks, release workflow, complete archives, installed files, lock compatibility
and framework type checks. The framework package build also passed locally using
the installed release. This is historical evidence for the recorded lockfile;
the framework's hosted Windows release-evidence job separately verifies its
complete build and subprocess contracts.

The [DTSX 0.11.21 and Pantry 0.11.113 plan](./receipts/toolchain-2026-10-21-plan.json)
and [executed receipt](./receipts/toolchain-2026-10-21-receipt.json) retain the next
adoption. DTSX now normalizes graph entrypoints, absolute specifiers and directory
index resolution. Its public Bun plugin and graph cases passed on all three
operating systems. Pantry retries interrupted response bodies within the
existing bounded request budget, closing and restarting partial downloads.
Its source, native Windows runtime, native build and publication gates passed.

Both releases used their owning repository's existing `bun run release:patch`.
The receipt checks original publication SHA-512 identities, complete archives,
installed files, the frozen Bun lock, lock compatibility and framework types.
Stacks' three workflows pin Pantry's verified release commit and declared
version; all three runtime consumers declare the matching SDK range.
The [native archive readback](./receipts/toolchain-2026-10-21-native.json) records
all twelve DTSX and seven Pantry archive hashes and an actual macOS arm64 Pantry
version probe. Archive checks do not establish execution on other platforms.
The framework's hosted Windows build and process tests remain a separate gate.
