// Stacks lints and formats with pickier, never eslint. This package is the
// framework-facing name for that: it re-exports pickier's public API so app
// and framework code can `import { runLint } from '@stacksjs/lint'` without
// pinning the underlying tool at every call site. pickier is a real dependency
// here (not a better-dx dev tool) because this package imports it at runtime,
// and `frameworkExternal()` keeps it out of the bundle so it resolves from the
// consumer's node_modules.
//
// The dependency is a RANGE, not an exact pin. It was pinned to 0.1.43, which
// meant every app carried a `no-unused-vars` false positive on any function
// with a multi-line generic return type: the rule missed the body entirely, so
// a used parameter read as unused and `lint --fix` renamed it to `_name`,
// leaving the body referencing an identifier that no longer existed. An
// autofix that silently breaks working code is the worst kind, and an exact
// pin meant pickier's own fix (0.1.46) could never reach anyone. The floor is
// that version; patches above it flow.
export * from 'pickier'
