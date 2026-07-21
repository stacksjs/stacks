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
