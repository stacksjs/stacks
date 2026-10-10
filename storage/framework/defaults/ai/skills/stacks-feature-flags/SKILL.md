---
name: stacks-feature-flags
description: Use when implementing per-user or per-team feature rollouts, persisted flag values, percentage experiments, or weighted variants. Covers @stacksjs/feature-flags and config/feature-flags.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Scoped feature flags

This package manages user-targeted runtime values. Framework bundle enablement
through the named `feature()` export from `@stacksjs/config` is a different
surface; read stacks-features.

## Define, scope, and evaluate

Import Feature or createFeatureFlags from @stacksjs/feature-flags. Definitions
can be fixed values or resolvers. Feature.for(scope) returns a scoped facade
with async value/values/all, active/inactive, activate/deactivate/forget and
when/unless. Await evaluations and writes; they are not synchronous booleans.

percentage(percent) and variants(weights) deterministically bucket a flag name
and scope key. Keep scope identities stable to preserve cohort assignment.
The manager supports explicit missing-flag behavior and evaluation listeners.
Changing a definition is not the same as forgetting already-persisted values.

## Drivers and boundaries

The global Feature facade resolves configured memory or database storage lazily.
Memory state is process-local. The SQL driver supports the dialects checked by
configuredDriver, and failures raise FeatureFlagStoreError rather than silently
switching a production experiment to memory. Inspect the actual config and
store schema before rollout. Persisted value types are validated by the package.

Do not send private cohort inputs to the browser or use a feature flag as the
only authorization check. Test stable scope keys, variant assignment, missing
definitions, persistence, concurrent evaluation and explicit value overrides.

Source: core/feature-flags/src/{index,manager,scope,strategies,schema,value}.ts
and drivers/. Retained evidence: manager, global, scope, strategies and both
driver test suites.
