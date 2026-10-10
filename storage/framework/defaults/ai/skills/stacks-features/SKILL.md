---
name: stacks-features
description: Use when installing or disabling optional Stacks bundles, understanding model/migration/view gates, or choosing default route bundles. Covers @stacksjs/features and @stacksjs/config feature controls.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Optional framework bundles

The installable bundles are declared by FEATURE_NAMES in @stacksjs/features/names.
They include dashboard, commerce, cms, forms, marketing, monitoring, realtime
and queue. FEATURE_FILES and FEATURE_TABLES own scaffold and migration selection.

## Installation and gates

Use buddy <feature>:install or the corresponding uninstall command after
checking its current help. Installation publishes the feature's app scaffold;
config/<feature>.ts enabled controls the feature. There is no required central
config/features.ts manifest. Preserve application-owned overrides during changes.

feature(name), enableFeature, disableFeature, resetFeature and listFeatures from
@stacksjs/config read config and runtime overrides. With no config section,
only dashboard defaults on. A present config object without an enabled field
counts as enabled, and its optional env gate can restrict environments.
Runtime overrides are process-local, not a persisted rollout system.

Auth and email also have config gates but are not installable bundle names.
Auth model loading does not by itself mount every default auth endpoint.
STACKS_DEFAULT_ROUTES explicitly selects route bundles; an explicit selection
has different precedence from default feature-driven selection. Read stacks-routes.

## Schema and discovery

The migration corpus excludes disabled bundle tables while protecting app-owned
models. Turning off a feature is not permission to drop its production data.
Package discovery can add resource roots; components require explicit opt-in
because bare component tags are process-wide.

STACKS_CANONICAL_FEATURES is an artifact-generation mode, not a production
configuration shortcut. Use stacks-feature-flags for scoped experiments.
Test the enabled app surface, route selection, preserved overrides and no-op
reinstallation rather than checking only a package's presence.

Source: core/features/src/{names,index}.ts, core/config/src/features.ts,
core/router/src/route-loader.ts and buddy feature lifecycle tests.
