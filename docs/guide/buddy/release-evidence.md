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

An integrity match proves archive identity against the plan. This command does
not validate registry signatures or SLSA attestations, establish redistribution
rights, prove native execution, or guarantee original-game fidelity. Include
the actual native and product acceptance scripts in the consumer checks and
retain their platform execution evidence separately.
