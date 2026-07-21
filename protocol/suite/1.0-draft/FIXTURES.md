# Conformance fixture specification

The fixture corpus is language-neutral JSON. A runner maps each `operation` to
its implementation without importing Stacks.js packages or reproducing internal
types. The observable contract is the ordered input, output, event, and state
transition described by the fixture.

## Execution

1. Check declared prerequisites. An unavailable prerequisite produces `skipped`,
   not `pass`; an absent implementation capability produces `unsupported`.
2. Reset the runner sandbox using the fixture seed, UTC clock, filesystem root,
   database contents, and registered routes/drivers.
3. Invoke each operation in order and record normalized output and events.
4. Apply only the fixture's declared normalization rules.
5. Compare expected status, output, events, state, and redaction assertions.
6. Emit one result per requirement. A mismatch is `fail` even when later steps pass.

Runners MUST NOT normalize semantic values, reorder lifecycle events, ignore
unexpected fields, or convert errors into skips. JSON object keys are unordered;
arrays remain ordered unless a fixture explicitly names an order-insensitive path.

## Nondeterministic fields

- timestamps use the fixture's fixed UTC clock or the token `<timestamp>`;
- generated identifiers use `<id:n>` in first-observed order;
- sandbox paths become `<root>/relative/path`;
- platform path separators become `/` only at declared path fields;
- secret, stack, query, and filesystem leak checks are negative assertions and
  cannot be removed through normalization.

## Runner adapter

A third-party runner implements the operation names it supports, validates this
corpus against `schemas/fixture-corpus.schema.json`, and writes the report format
defined by RFC 0004. It may execute a partial profile, but cannot claim that
profile while any inherited requirement is skipped, unsupported, failed, or experimental.
