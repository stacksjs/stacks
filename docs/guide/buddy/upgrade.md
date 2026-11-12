---
title: Upgrade Command
description: "Upgrade Stacks, synchronize framework defaults and skills, and refresh the agent setup already used by your project."
---
# Upgrade Command

`buddy upgrade` updates the Stacks framework. It synchronizes the framework's
managed files and bundled skills, then refreshes the agent setup your project
already uses. `buddy update` is an alias.

```bash
buddy upgrade --dry-run     # Review the target and proposed changes
buddy upgrade               # Apply the upgrade
buddy test                  # Verify your application against the new framework
```

Run this in an application checkout. Framework contributors update the Stacks
source through Git, then test and release that source for applications to use.
Keep application customizations in `app/`, including `app/Skills/` for skill
overrides, rather than editing framework-managed files.

## Choose a release or source

| Option | Behavior |
| --- | --- |
| `-V, --version <version>` | Select a published framework version |
| `--stable` | Select the latest stable release |
| `--canary` | Select the canary channel; vendored apps sync `main`, package-managed apps use the npm `canary` dist-tag |
| `--from <path>` | Sync a vendored app from a local Stacks source checkout |
| `--dry-run` | Preview without writing files, installing dependencies, running migrations, or refreshing AI setup |
| `--allow-downgrade` | Accept older dependency versions that the target release requires |
| `-f, --force` | Reapply the selected target; in vendored apps, also allow overwriting uncommitted managed files |
| `--no-postinstall` | Skip installation and follow-up hooks; review the recovery steps below |
| `--verbose` | Print diagnostic output |

```bash
buddy upgrade --stable --dry-run
buddy upgrade --version 0.75.517 --dry-run
buddy upgrade --canary
buddy upgrade --from ~/Code/stacks --dry-run
```

An explicit version selects that release. Otherwise the saved channel applies,
with stable as the default. A vendored app can auto-detect a nearby Stacks
checkout when no explicit release/channel choice prevents it. Read the printed
`source:` line to confirm what will be installed. `--from` is for vendored apps;
package-managed apps install published releases.

Stable refers to the published release channel, not a guarantee that your app
needs no compatibility testing. Review the [release notes](https://github.com/stacksjs/stacks/releases)
and the [upgrade guide](/upgrade-guide) before applying changes.

## What the framework upgrade changes

### Package-managed apps

When `storage/framework/core` is absent, the upgrade selects a published
`stacks` release, aligns applicable framework declarations in `package.json`,
and installs that exact target. It checks the installed version before syncing
managed project files from `@stacksjs/defaults`.

The invoking CLI bootstraps the install. Completion then runs once in a fresh
Bun process using the installed target's matching actions package. This lets
the target apply its own scaffold migrations even when the app started with
older actions or the target is newer than the CLI. A failed target migration
fails the upgrade and retains the installed files for diagnosis. A dry-run
does not install or invoke the target; its scaffold preview uses the currently
installed framework.

The sync refreshes launch scripts, supported project configuration, and an
existing vendored defaults copy. Apps using a link to `@stacksjs/defaults`
continue to use that package. A copied defaults tree receives a version stamp
at `storage/framework/defaults/.stacks-sync.json`; files the package no longer
ships are removed from that copy. Keep overrides in `app/`.

Flat `overrides` and `resolutions` for lockstep framework packages follow the
selected release. Nested rules, aliases, local links, `$dependency` references,
and independently versioned packages retain their application-defined values.

The release's paired STX versions and Craft minimums are also considered. A
newer STX patch on the same release line is retained by default. Other declared
downgrades are listed and refused before writing or installing. Use
`--allow-downgrade` only when you intend to accept the target's versions; it
also opts into replacing a retained newer STX patch. Craft declarations below
the release's minimum are raised, while newer versions are retained.

### Vendored apps

When `storage/framework/core` exists, the upgrade syncs framework source:

- `storage/framework/core/`, including runtime packages and commands.
- `storage/framework/defaults/`, including built-in actions, models and AI skills.
- `storage/framework/types/`, excluding the app-generated browser/server declarations.
- The root `buddy` and `bootstrap` launchers.

Derived directories and files such as `node_modules`, `dist`, and package
lockfiles under the core tree are excluded. The sync copies additions and
changes; files absent from the source are reported but retained in this path.
Uncommitted edits in managed paths stop the upgrade unless `--force` is set.

If the upgrade action itself changes, it restarts once using the new action so
new sync paths and deferred hooks can run in the same invocation.

## Skills and agent setup

Bundled skills ship as framework defaults. An upgrade refreshes those sources,
then runs `buddy setup:ai <provider> --force` for detected providers: Claude,
Cursor, Copilot, and Gemini. Codex setup always runs so a missing `AGENTS.md`
can be seeded. It does not enable every provider in a project.

Claude setup adds links for new skills and refreshes existing generated skill
entries. Framework skills and project overrides under `app/Skills/` use the
same resolution order as a manual setup. Generated files installed with
`--copy` can be replaced by the forced refresh; keep authored skill changes in
`app/Skills/`. Existing authored `AGENTS.md`, real `CLAUDE.md`, and
`.claude/launch.json` are preserved by setup.

A failed agent refresh fails the upgrade and reports the provider's repair
command. To refresh a provider separately:

```bash
buddy setup:ai claude --force
```

The framework distributes its reviewed skill snapshot. It does not download
arbitrary upstream skill repositories during an application upgrade.

## Follow-up hooks and recovery

Package-managed upgrades refresh dependencies before syncing defaults and agent
setup. Vendored upgrades regenerate auto-imports, refresh dependencies when
needed, regenerate an existing `database/types.d.ts`, and apply pending local
migrations when `database/migrations/` exists. A `pantry.lock` selects Pantry
for the vendored dependency refresh; otherwise Bun runs. Both use
`install --force`.

Vendored auto-import, dependency-install and database-type failures currently
print non-fatal warnings. Migration and agent-setup failures return a nonzero
exit. Read the complete output and resolve warnings before deploying.

`--no-postinstall` skips these follow-up steps. For package-managed apps it
also returns before the installed defaults and agent setup are synchronized.
Use it to stage a manifest change, then rerun the upgrade without the flag to
complete installation and synchronization.

If files synchronized but a hook failed, repair the reported step and rerun
with `buddy upgrade --force` to reapply the target and hooks. Run your tests,
lint and typechecks before deploying. A preview performs none of these writes
or hooks.

## Why a dependency install alone is insufficient

Changing the `stacks` version and running `bun install` updates installed
packages, but does not perform the upgrade's managed project-file sync or
refresh generated agent entrypoints.

Boot uses a packaged defaults copy when a stamped vendored copy is older than
the declared installed framework. An unstamped tree retains the legacy
vendored precedence. `buddy dev`, `buddy doctor`, and `buddy upgrade --dry-run`
report defaults drift; `buddy upgrade` reconciles it.

## Other upgrade commands

| Command | Scope |
| --- | --- |
| `buddy upgrade:dependencies` / `upgrade:deps` | Run the project's dependency update action (`pantry --update && bun install`) |
| `buddy upgrade:bun` | Invoke the Bun upgrade action; inspect its availability in your installed release |
| `buddy upgrade:shell` | Refresh the Oh My Zsh Buddy integration |
| `buddy upgrade:binary` | Build and install the global Stacks binary; the CLI currently requires root |
| `buddy upgrade:all` | Request framework, dependency, Bun and binary upgrades |

These commands have different scopes. Plain `buddy upgrade` does not update
all unrelated dependencies or the system runtime. The dependency action does
not implement security prioritization or an interactive major-version review.
Use [Buddy Bot](https://github.com/stacksjs/buddy-bot) for a reviewed dependency
update workflow.

## Roll back deliberately

Before upgrading, commit application changes and back up any database the
vendored migration hook can change. Git can restore tracked manifests and
lockfiles, but cannot restore a gitignored defaults copy or undo migrations.

To return to a published framework release, preview it explicitly:

```bash
buddy upgrade --version <previous-version> --allow-downgrade --dry-run
```

Apply the same command without `--dry-run` after reviewing it. Restore the
application's corresponding tracked files and database backup as required by
that release. Installing an older `stacks` dependency alone does not reverse
all managed files or database changes.

## Related commands

- [Command reference](/guide/buddy/commands)
- [Health checks](/guide/buddy/commands#doctor)
- [Using skills](/skills/using)
