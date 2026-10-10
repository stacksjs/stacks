---
name: stacks-config
description: Use when working with Stacks configuration, asynchronous overrides, driver capability evidence, framework feature gates, package resource discovery, or request context. Covers @stacksjs/config and the config/ directory.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Configuration

Read the application's `config/*.ts` and exported types before proposing a
setting. Config is typed executable code; a copied options inventory can drift.

## Loading and readiness

~~~ts
import { config, overridesReady } from '@stacksjs/config'

await overridesReady
const applicationName = config.app.name
~~~

The config proxy merges framework defaults with asynchronous application
overrides. Read it after overridesReady when initializing a driver or caching a
scalar setting. Destructuring before readiness can capture a default forever.
The readiness promise and override storage are shared across installed copies.
Compiled server builds have a separate minimal env config and may deliberately
set `SKIP_CONFIG_LOADING=true`; see `stacks-server`.

Individual exports (app, auth, database, queue, filesystems and others) are also
available. Use the matching `satisfies ...Config` type or define helper.
`defineModel` belongs to `@stacksjs/orm`. App registries are owned by their
packages: defineEvents/defineListener by events, defineMiddleware by router,
defineGates by auth and defineCommand by cli.

## Driver capability evidence

`capabilityRegistry`, `capabilityDrivers(category)`,
`findCapability(category, name)` and `assertCapabilityAvailable` are
exported by `@stacksjs/config`. Read status, topology, prerequisites,
limitations and testEvidence before promising provider support.

- Supported local drivers have retained local tests. Supported remote drivers
  name a version and CI workflow in liveServiceContract.
- Partial drivers have an implementation with narrower retained evidence.
  For S3/Azure and external mail this includes request/signature/config checks,
  without a live object round-trip or delivery assertion.
- Experimental drivers are usable within their documented limitations, without
  the supported conformance claim.
- Unsupported and unknown drivers throw through assertCapabilityAvailable.
  A config-shaped entry alone is not an implemented runtime driver.

`validateConfig(snapshot)` returns path/message issues; `reportConfigIssues`
prints them. Boot validation checks important known fields, not every possible
option. Read `validators.ts` before treating it as a complete schema validator.

## Framework feature gates

`feature(name)` reads a bundle's `config/<name>.ts`. Explicit runtime
enableFeature/disableFeature overrides win, then config enabled and its optional
env allowlist, then framework fallback (dashboard is on when config is absent).
resetFeature removes a runtime override; listFeatures snapshots the known set.

Use `buddy features` and the bundle's install/uninstall commands to inspect
and change installed feature resources. Runtime config gates and installation
are related but not interchangeable. The `auth` gate controls account-family
model loading; default auth routes are selected by STACKS_DEFAULT_ROUTES.
The `email` gate controls the implicit email webhook route bundle.

Application config flags augment AppFeatureFlags. Runtime targeting,
experiments and persisted user flags belong to the separate native
`@stacksjs/feature-flags` package. Read its exports/config before using it;
`feature()` is not an A/B allocation API.

## Native resource discovery

Discovered packages can contribute routes, models, jobs, migrations, views and
explicitly opted-in components through their package Stacks metadata.
`packageModelRoots/packageJobRoots/packageMigrationRoots/packageViewRoots/
packageComponentRoots`read`storage/framework/discovered-packages.json`.
Missing manifests mean no package resources. Component directories are opt-in
because bare tag names enter a global template namespace. Package migration
sources are copied before any preprocessing; installed package files are read
as resources, not rewritten in place. See `stacks-plugins`.

Default view selection uses `resolveViewPatterns` and the exported bundle
metadata. Request-local configuration context lives in `request-context.ts`:
`useRequestEvent()` reads the scoped request snapshot, while entrypoints
install scopes. Request context must be established per request; globals or
cached snapshots cannot represent concurrent users.

## Configuration paths

| Concern | Read |
|---|---|
| application, SEO, launch | app.ts |
| model connection and SQL behavior | database.ts, query-builder.ts |
| credentials, sessions, cookies, OAuth, magic links | auth.ts, hashing.ts |
| model API exposure and row ownership | security.ts |
| background work and cache | queue.ts, cache.ts |
| uploads and disks | filesystems.ts, default local disk |
| mail, SMS and notifications | email.ts, sms.ts, notification.ts, services.ts |
| deployment | cloud.ts, its named tsCloud export and default wrapper |
| frontend | stx.ts, crosswind.ts, ui.ts |
| agent installation | app/Skills/, defaults/ai/, stacks-skills package |

Use `stacks-env` for validated/coerced environment variables, encrypted files
and shared-box tenant isolation. Config files hold expressions referencing env;
editing a nested live object is not the same as persisting that source file.

## Sources and verification

Public contract: `storage/framework/core/config/src/index.ts`,
`config.ts`, `overrides.ts`, `capabilities.ts`,
`features.ts`, `discovered-resources.ts` and `request-context.ts`.
Retained tests are under `core/config/tests/`; driver readiness also has
`core/search-engine/tests/early-proxy.test.ts`.
