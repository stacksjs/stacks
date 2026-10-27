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

## A website alongside a native app

Native projects can keep their marketing pages under `resources/` and use the
same stx compiler, components and ts-css configuration as the desktop UI.
Declare the website directory in `stx.config.ts`:

```ts
export default {
  root: 'resources',
  pagesDir: 'views/site',
  componentsDir: 'components',
  css: { config: 'config/css.ts' },
}
```

Create `resources/views/site/index.stx`, place public images in `public/`, then run:

```sh
./buddy dev --site --port 3000
./buddy build --site
```

The development server binds to loopback and includes stx hot reload. Website
builds go to `dist/site`, so cleaning their output preserves signed desktop
artifacts. Plain `buddy dev`, `buddy build` and `buddy package` continue to use
the desktop entry in `craft.config.ts`. The website does not start the desktop
backend or require the Craft toolchain.
