---
name: stacks-test-fixtures
description: Use when replacing unsafe assertions in tests, building partial fixtures, or preserving intentionally invalid input cases. Covers typed fixture builders, Bun tests, and Stacks public test seams.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Typed test fixtures

The Stacks-native counterpart to Matt Pocock's `migrate-to-shoehorn` workflow.
Read [the adaptation rules](../stacks-flow/ENGINEERING.md), `stacks-testing`, and
`stacks-tdd`. Source and MIT attribution are in [NOTICE.md](NOTICE.md) and
[LICENSE](LICENSE).

## Migration

1. Inspect the named test files and the behavior they exercise. Distinguish a
   needlessly large fixture from intentionally malformed input. Keep tests at
   their public seam; do not extract production code solely to avoid a fixture.
2. Prefer a real Stacks request, model factory, or the existing fixture builder.
   For a plain domain type, use a typed builder with valid defaults and explicit
   overrides. `satisfies` checks a fixture without discarding its inferred shape.
3. A partial object is valid only when the public interface accepts it or a
   fixture builder completes it. `Partial<T>` alone does not make it a valid
   `T`. Avoid pretending missing fields exist at runtime.
4. Keep invalid-input coverage at a validation seam that accepts `unknown`,
   such as a real request or schema parser. If a cast is unavoidable in a test
   of a typed external interface, isolate it, explain the intentional invalidity,
   and keep it out of production code.
5. If the project already uses Shoehorn or the user specifically requests it,
   inspect its installed API and use it in tests only. Add or update it through
   Bun only when needed for that request; do not make it a framework dependency.
6. Run the focused tests and relevant typecheck. Completion means valid fixtures
   still satisfy the public types and malformed cases still prove rejection.

Do not replace one assertion with an unchecked generic helper and call that
type safety. Preserve the reason for each test and verify observable behavior.
