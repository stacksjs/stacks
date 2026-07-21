---
title: Add Registry Stacks
description: Pull project-shaped extensions from the Stacks registry and merge their source files into an application.
---

# Add Registry Stacks

A stack is a source overlay with the same top-level structure as a Stacks project. It can provide files under `app`, `config`, `database`, `resources`, `routes`, `public`, `locales`, and `docs`.

Install a registered stack by its short registry name:

```bash
buddy add calendar
buddy add table
```

Buddy resolves the name exclusively through the first-party Stacks registry, pulls the registered GitHub repository, validates its `package.json` stack metadata, and copies its project directories into the current application. The copied files become normal application source. They are not hidden in `node_modules` or `pantry`.

## File conflicts

Existing application files are preserved by default:

```bash
buddy add calendar --conflict skip
```

Use `backup` to preserve the current file before replacing it, or `overwrite` when the registry version should replace it:

```bash
buddy add calendar --conflict backup
buddy add calendar --conflict overwrite
```

Preview the exact file plan without writing anything:

```bash
buddy add table --dry-run --verbose
```

Buddy records installed paths and their SHA-256 checksums in `storage/framework/stacks.lock.json`. Uninstall refuses to delete files changed by the application after installation:

```bash
buddy stack:uninstall calendar
```

Use `--force` only when those application edits should also be removed.

## Authoring a stack

Scaffold a project-shaped repository:

```bash
buddy make:stack activity-feed
```

Add only the project files the stack owns, push the repository to GitHub, and submit its source to the central registry. The repository `package.json` must declare a matching name:

```json
{
  "name": "@example/activity-feed",
  "version": "0.0.1",
  "stacks": {
    "name": "activity-feed",
    "description": "Activity feed actions, models, routes, and STX views",
    "directories": ["app", "database", "resources", "routes"]
  }
}
```

Registry installation is source-based. Publishing the repository as an npm library is optional and does not change how `buddy add` installs it.
