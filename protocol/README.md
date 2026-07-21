# Protocol evidence

Stacks consumes the canonical protocol suite from
[`stacksjs/rfcs`](https://github.com/stacksjs/rfcs). The files below
`suite/1.0-draft` are a generated, immutable snapshot: do not edit them by hand.

- `suite.lock.json` records the exact RFC commit and SHA-256 digest of every file.
- `bun run protocol:check` rejects missing, changed, or extra vendored files.
- `bun run protocol:sync -- --source ../rfcs` intentionally refreshes the
  snapshot from a local RFC checkout and rewrites the lock.
- `bun run protocol:conformance` executes the Stacks adapter, validates the
  resulting JSON against the canonical schema, and writes JSON and Markdown
  evidence to the ignored `protocol/reports` directory.

The adapter does not infer conformance from an existing unit test. A result only
becomes `pass` when the corresponding protocol fixture is executed through a
public Stacks API and linked to revision-specific evidence. Until every inherited
requirement passes, `profileClaim` remains `null`.

`evidence/source-manifest.json` is a deterministic inventory of an immutable
Stacks Git revision. Its digest is SHA-256 over the complete recursive Git tree
listing (modes, blob identities, sizes, and paths). It separates source, tests,
generated output, configuration, documentation, vendored protocol material, and
assets; records every versioned workspace package and runtime prerequisite; and
states the implementation's non-certifying classification. Refresh it explicitly
with `bun run protocol:manifest`, then review and commit the resulting snapshot.

`evidence/drivers.json` is generated from the runtime capability registry used by
configuration validation. Each database, queue, cache, storage, mail, realtime,
and deployment driver is classified as supported, partial, experimental, or
unsupported, with implementation paths, test evidence, topology, prerequisites,
and explicit limitations. CI rejects stale evidence and operational entries whose
implementation or cited tests do not exist.

`evidence/desktop-support.json` is generated from the Craft support policy. A
target cannot become stable until native install/launch and update/rollback
evidence is linked and signing (plus macOS notarization) is enforced. The build
also refuses a stable channel for unqualified targets and emits exact source,
runtime digest, per-file SHA-256 checksums, and platform metadata.
