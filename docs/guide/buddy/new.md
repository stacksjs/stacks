---
title: New Command
description: Create a Stacks application or adopt an existing native app.
---

# New Command

`buddy new my-app --minimal` creates a package-managed Stacks application.

## Offline native apps

```sh
buddy new my-desktop-app --native
cd my-desktop-app
./buddy dev
./buddy build
./buddy package
./buddy upgrade
```

The native profile creates `src/app.stx`, `craft.config.ts`, and a Buddy entry
script. It installs stx, desktop APIs, and Buddy without adding web routes,
a server launcher, database configuration, or framework defaults. The packaged
app contains Craft and compiled assets; Bun and Buddy are development tools.
Install the Craft runtime through Pantry, or set `CRAFT_BIN` to a source build.

To integrate an existing native app in place:

```sh
buddy new . --native --adopt
```

Adoption requires `package.json` and `craft.config.ts`. It retains the app's
source, identity, dependency ranges, and existing scripts. Plain `new` refuses
occupied directories. Set scripts to `./buddy dev`, `./buddy build`, and
`./buddy package` to use the shared native build pipeline.

`craft.config.ts` exports the stx native build configuration. Paths resolve
relative to the app. A status-item app with a live UI sets `trayPopover: true`;
`menubarOnly: true` creates a status item without a page. Native upgrades update
the declared packages through Bun; `--dry-run` previews without writing.
