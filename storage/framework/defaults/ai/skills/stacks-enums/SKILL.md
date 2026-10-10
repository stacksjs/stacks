---
name: stacks-enums
description: Use when working with framework constants in a Stacks application - NpmScript commands, Action identifiers, or any enumerated constants used across the build system, CLI, and actions. Covers @stacksjs/enums.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Enums

Use `@stacksjs/enums` for internal NpmScript and Action identifiers. Read their
actual enum members rather than deriving command names from an old copied list.

## Action paths

Action values identify framework action source paths, for example BuildViews is
build/views and QueueWork is queue/work. The enum's source links point at each
handler; the action-source-links test verifies the member/path/file agreement.
This is the framework's dispatch vocabulary, distinct from an application action
path and from the public buddy CLI command registry.

Current members include component/library/native app builds, auth setup/pruning,
generation/release, migration/seed, queue inspection/DLQ/quarantine/pause/resume,
search, scheduling and upgrades. Read stacks-actions/stacks-buddy for dispatch
and command invocation. Removed BuildVueComponentLib/MigrateDns/BuildComponents
symbols should not be resurrected because an older skill lists them.

## Script values

NpmScript contains both script names and literal command strings. Some values
invoke pickier or Bun tests directly; they are not all keys in package.json.
Use ./buddy lint and the project's actual scripts for user workflows. Treat
Clean/Fresh/Release as real operations, not harmless metadata probes.

## Scheduling constants

The Every enum lives in `@stacksjs/types` (core/types/src/cron-jobs.ts), not the
enums entry. Its seconds forms need the appropriate scheduler layer; a six-field
enum value does not make the low-level five-field parser accept arbitrary seconds.
Read stacks-scheduler/stacks-cron for that distinction.

## Source and verification

`storage/framework/core/enums/src/index.ts` is the authoritative list.
Retained tests: core/enums/tests/enums.test.ts and action-source-links.test.ts.
When adding an internal action, add the enum member/source link and the handler,
then verify its actual resolver and any public command registration separately.
