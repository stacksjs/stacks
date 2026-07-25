---
title: How to set up your IDE
description: Configure an editor for Bun, TypeScript, STX templates, and Pickier.
---
# How to set up your IDE

Open the project root so the editor can discover `tsconfig.json`, the generated auto-import declarations, and repository settings. Use the workspace TypeScript version and associate `.stx` files with HTML language support.

The root `tsconfig.json` is the only one you own. It extends
`storage/framework/tsconfig.app.json` and restates the tunable defaults, so you
can override a single option or delete it and inherit. Framework internals have
their own config, which your editor will pick up when you open a file under
`storage/framework/`.

Run `./buddy generate:ide-helpers` after changing models, routes, components, or auto-imports. Pickier remains the source of truth for linting and formatting.

If you use an AI coding agent, `./buddy setup:ai` scaffolds it from
`storage/framework/defaults/ai/` - the shared `AGENTS.md` plus whichever files
your agent reads.

See [IDE setup](/bootcamp/how-to/ide-setup) for VS Code, Cursor, Zed, and JetBrains configuration.
