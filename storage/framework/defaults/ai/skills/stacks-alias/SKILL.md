---
name: stacks-alias
description: Use when debugging source aliases, package/subpath resolution, or the boundary between checkout and published imports. Covers @stacksjs/alias and its active resolver consumers.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Path Aliases

Use `@stacksjs/alias` to inspect the framework's source alias map and debug a
configured build resolver. The exported alias object is metadata; importing it
does not install a universal module resolver.

## Actual mappings

The map in `storage/framework/core/alias/src/index.ts` uses @stacksjs/path to
resolve project-relative resources to concrete paths. Many packages have
@stacksjs/name and stacks/name aliases plus wildcard subpaths, but only entries
actually in the map are promised. Cli maps to core/cli, Buddy to core/buddy;
they are separate packages.

Configuration/resource aliases cover declared config paths and resources. Read
that source and the active tsconfig/bun/build configuration for exact spellings;
a fixed count or schematic wildcard table cannot establish runtime resolution.
An application override changes the source root resolved by @stacksjs/path.

## Source versus published consumers

Public @stacksjs package names and declared subpaths are the portable imports.
Source aliases help the framework checkout and configured Stacks app build.
A published consumer must resolve package exports without reaching outside its
installed package. Do not invent a subpath merely because a matching source
file exists behind a wildcard alias. Declaration and runtime export validation
are separate checks.

When adding a source alias, update the actual map and the consuming resolver;
check its package's exports/build entries as well. Relative imports within a
package are ordinary implementation imports; using a relative path that escapes
into another package's unpublished types is the problem. Avoid the former rule
that all relative imports are forbidden, since framework code itself uses them
to keep internal modules and cycle boundaries explicit.

## Verification

Source: `core/alias/src/index.ts`, active tsconfig.json and the build/runtime
consumer reading the map. Retained coverage: `core/alias/tests/alias.test.ts`.
For missing globals, read stacks-auto-imports; aliases solve module resolution,
not injection of ambient names into a browser or server request.
