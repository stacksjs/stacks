// Stacks lints and formats with pickier, never eslint. This package is the
// framework-facing name for that: it re-exports pickier's public API so app
// and framework code can `import { runLint } from '@stacksjs/lint'` without
// pinning the underlying tool at every call site. pickier is a real dependency
// here (not a better-dx dev tool) because this package imports it at runtime,
// and `frameworkExternal()` keeps it out of the bundle so it resolves from the
// consumer's node_modules.
export * from 'pickier'
