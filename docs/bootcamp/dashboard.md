---
title: Extending the Dashboard
description: Add STX dashboard pages, actions, and navigation without editing framework defaults.
---
# Extending the Dashboard

Application files override framework defaults by path. To customize a dashboard page or action, create the matching file under your application's `resources/` or `app/` directory and keep the framework copy unchanged.

Use STX components from `resources/components/`, ts-css utilities for styling, and server actions for data access. Register new navigation destinations in the application dashboard configuration.

Run the dashboard during development with:

```bash
./buddy dev dashboard
```

See [Extending the dashboard](/bootcamp/how-to/extend-dashboard) for a complete example.

## GitHub Issues

Run `./buddy dev --dashboard` and open **GitHub Issues** in the top navigation.
The view combines open and closed issues from the GitHub repositories of your
registered local Stacks projects. Use the search box and project or status
filters to find an issue, then select its title to open it on GitHub.

The view uses the same project list as the dashboard's project switcher. Add a
checkout with `buddy projects:add <path>` or discover checkouts with
`buddy projects:scan`. Buddy uses the GitHub remote named `origin` when
available, then `upstream`, then another GitHub remote. For private
repositories, sign in with `gh auth login` or provide a GitHub token
with permission to read issues.

## Personal sidebar order

Drag section and item grips to change their order. You can also focus a grip
and use the up and down arrow keys. Rows stay within their current group;
moving a parent preserves its children. Use **Reset order** in the sidebar
footer to restore the current team defaults.

Stacks stores this preference in a private local file, separate from your
application source. The base directory is `$XDG_CONFIG_HOME/stacks/dashboard/`,
`~/Library/Application Support/stacks/dashboard/` on macOS, or
`~/.config/stacks/dashboard/` elsewhere. Files are scoped to the canonical
project path and dashboard viewer. They survive sessions, framework upgrades
and runtime cache cleanup. They are saved on the machine serving the dashboard.

Keep team navigation in `config/dashboard.ts` and model metadata such as
`dashboard.highlight` and `dashboard.icon`. Personal ordering changes identifiers
only, preserving the team's labels, access rules and model grouping.

## Dashboard themes

Open **Settings → Appearance** to switch between **The Original** and **System
Cleaner**. The Original keeps the macOS and Arc sidebar options. Each theme
follows your light, dark or system preference. System Cleaner puts one link per
section in the sidebar. The dashboard home links to those sections as cards,
and each section index lists its available pages as cards.

To make a theme, choose **Download starter theme**, edit the JSON file, and
choose **Install theme**. Install selects the theme immediately. Installing
another file with the same custom ID updates that theme. Select an installed
theme to export it or remove it. Removing the active theme returns you to
The Original. Resetting appearance keeps your installed themes available.

Theme files use version 1 of the format:

| Field | Value |
| --- | --- |
| `version` | `1` |
| `id` | A unique ID of up to 48 lowercase letters, digits and hyphens. Start with a letter. `original` and `system-cleaner` are reserved. |
| `name`, `description` | The visible name (up to 64 characters) and an optional description (up to 180 characters). |
| `layout` | `flush` or `inset`. Both use the full-width content area on mobile. |
| `navigation` | `plain` or `tiles` for the expandable sidebar, or `sections` for direct section links and card indexes. |
| `overview` | `panel` for a gradient header, or `immersive` to extend the gradient behind the entire overview. Defaults to `panel`. |
| `radius` | A whole number from 0 to 24, in pixels. |
| `light`, `dark` | Both palettes from the starter file, with six-digit hex colors. |

The palettes cover the window (`window`), page background (`canvas`), shared
panels (`surface`, `surfaceMuted`), foregrounds (`text`, `muted`), dividers
(`border`), and controls (`accent`, `accentFill`, `accentText`). Use
`heroStart`, `heroEnd`, and `heroText` for the dashboard overview.
Check legibility in both modes before sharing your JSON file.

Themes and the active choice are stored per browser and dashboard origin.
Export an installed theme to share it or use it on another dashboard.
