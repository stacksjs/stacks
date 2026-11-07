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
