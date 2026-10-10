---
name: stacks-registry
description: Use when working with the Stacks extension registry - framework extension metadata, package discovery, or the registry system. Covers @stacksjs/registry.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Registry

`@stacksjs/registry` exports the named/default registry array and Registry type.
The array derives from the central stackExtensionRegistry in `@stacksjs/types`,
not from a hard-coded core Stacks URL entry or the app's installed dependencies.
Each generated object carries name, github, optional package and description.

Registry aliases StackExtensionRegistry, which also permits string shorthand
names. Narrow an entry before accessing its object fields. config/stacks.ts is
the application's extension configuration, separate from this known-extension
catalog. A catalog entry does not mean that extension is installed.

Use stacks-plugins for stack install/uninstall, package discovery, resource
precedence and the lock/checksum contract. The central metadata links project-
shaped GitHub source and optional npm package; discovery reads a package's actual
stacks metadata. An umbrella extension can provide core and UI packages without
manually copying all resources into app/.

Source: `storage/framework/core/registry/src/index.ts` and
`core/types/src/stack-extensions.ts`. Evidence:
`core/registry/tests/registry.test.ts`. Read the registry at runtime rather than
duplicating its entries or a fixed package count in documentation.
