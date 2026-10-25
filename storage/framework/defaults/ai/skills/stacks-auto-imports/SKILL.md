---
name: stacks-auto-imports
description: Use before adding imports in Stacks app code, checking available runtime functions, browser/server delivery, model globals, or registry generation. Covers Stacks auto-imports, the generated runtime inventory, stx client delivery and server boot (107 models).
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Auto-imports and runtime delivery

## Available names in this project

Before adding imports, read the relevant section of
`storage/framework/auto-imports/RUNTIME.md` (relative to the project root).
Use its listed names directly in their stated execution context to avoid
redundant imports. This compact reference groups server globals by package
and barrel, and STX client helpers by runtime, macro and demand delivery.
It is generated from runtime registries, including app helpers and overrides.

`buddy generate`, `buddy generate:types`, `buddy generate:auto-imports` and
`buddy setup:ai` refresh it. If missing, run `buddy generate:auto-imports`.
The inventory stays in the project so copied skills read the current app's
names after subsequent generation. Keep package implementation files and
standalone scripts self-contained with explicit imports.

A declaration, a delivered client binding, and an initialized server global are
three different facts. Inspect the relevant runtime rather than inferring all
three from an ambient type file.

## Browser paths

STX client scripts receive eager runtime bindings, compiler-provided bindings,
and demand-inline composables emitted for supported authored calls. The eager
bare-window alias list in AGENTS.md and stacks-composables is checked against
getCachedSignalsRuntime. That list is one delivery path, not the entire API.

Current STX also supplies useMediaQuery/usePreferredReducedMotion through
runtime/compiler bindings, and useForm/useIntersectionObserver/useScroll/
useMouse/useParallax through demand delivery. Read
[BROWSER.md](../stacks-composables/BROWSER.md) for exact signatures, supported
installation versions, signal adapters and cleanup. Imported Stacks composables
can have different Ref contracts from the same-name bare client helpers.

storage/framework/browser-auto-imports.json feeds ambient declarations; it
is not a complete inventory of executable browser bindings. Utilities,
provider SDK helpers, stores and custom modules need explicit imports unless
the installed runtime/compiler/demand implementation actually supplies them.

Bindings injected into a script entry do not leak into an imported TypeScript
module. Every module declares its own functions, stores and type dependencies.
Component tag discovery is yet another pipeline; use resources/components or
explicitly opted-in package component roots.

## Server paths

Server boot resolves model, job, controller and function registries and injects
eligible values into globalThis. Model definitions exist on disk, but optional
features and initialization decide the loaded surface. Explicit app-model
imports preserve inference from the model actually customized by the app.

Only runtime model values are globals. ModelRow<typeof Model> and other type
utilities are imported types; UserRequest/UserRequestModel are not generated
runtime model variants. Names colliding with built-ins, such as Error/Request,
need explicit imports and safe local aliases.

The server's primitiveModules registry also injects framework helpers such as
Action, route, response, schema, path, storage, log and Auth. Use the generated
inventory to select bare names after Stacks boot. Package internals, standalone
tools and tests without boot still import their dependencies explicitly.

## Generation and project overrides

The auto-import barrels under storage/framework/auto-imports are generated from
app definitions, framework defaults and discovered package resources.
app/ definitions override defaults at the relevant resolver boundary. Models
also support additive extendModel rather than a complete copied override.

Use buddy generate and its documented type-generation variants. Do not hand-
maintain a second list of Action paths, middleware aliases or runtime model
names. The registry types derive from resolver maps; stale maps can reject a
new real file, while a typo in a fresh map is a real missing reference.

Application helpers belong in resources/functions and their normal exports.
Inspect the current generation/discovery pipeline before modifying a generated
barrel by hand. Components contributed by a package require explicit opt-in;
views/models/jobs/migrations have their own discovery conventions.

## Verification and gotchas

- Check client delivery in the installed STX, not only with buddy typecheck.
- Check server globals after boot or model readiness, not during a cyclic import.
- Distinguish function values from type-only exports and unavailable feature models.
- Keep imported browser modules self-contained and clean up observers/timers.
- Use request snapshots for stx server rendering; an API AsyncLocalStorage scope
  does not automatically span every render callback.
- Generated declarations and registries are artifacts. Regenerate and inspect
  differences rather than inventing globals to silence an error.

Source: core/server/src/imports.ts, core/orm/src/index.ts,
core/config/src/discovered-resources.ts, generated resolver barrels and installed
STX client/runtime/demand modules. Retained evidence includes
core/server/tests/generated-declarations.test.ts, ORM auto-import contracts,
composables/skill-runtime-globals.test.ts and STX delivery tests.
