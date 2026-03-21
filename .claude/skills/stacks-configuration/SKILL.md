---
name: stacks-configuration
description: Use when understanding or modifying the overall Stacks project configuration — all 44 config files, environment setup, bunfig.toml, tsconfig, or the configuration architecture. Covers the entire config/ directory and project-level configs.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Project Configuration

The Stacks framework uses 44 TypeScript configuration files plus several project-level configs.

## Configuration Directory
All framework configs are in `config/` — see the `stacks-config` skill for the full list.

## Project-Level Configuration Files
- `package.json` - Workspace, scripts, dependencies
- `tsconfig.json` - TypeScript (extends `storage/framework/core/tsconfig.json`)
- `bunfig.toml` - Bun runtime configuration
- `.env` / `.env.example` - Environment variables
- `.editorconfig` - Editor settings
- `.gitignore` / `.gitattributes` - Git settings
- `pantry.lock` / `bun.lock` - Lock files

## bunfig.toml Key Settings
```toml
[run]
bun = true                    # Use bun for all commands

[serve]
plugins = ["bun-plugin-stx"]  # STX template processing

preload = ["./storage/framework/defaults/resources/plugins/preloader.ts"]

[install]
linker = "hoisted"            # Required for better-dx
```

## tsconfig.json
Extends `storage/framework/core/tsconfig.json` for consistent TypeScript settings across the monorepo.

## Workspace Configuration
Defined in root `package.json`:
```json
"workspaces": [
  "storage/framework/**",
  "!**/node_modules/**",
  "!**/dist/**"
]
```

## System Requirements
- Bun >= 1.3.0
- SQLite >= 3.47.2

## Gotchas
- `better-dx` is in `package.json` for shared dev tooling — don't install its peers separately
- `bunfig.toml` must have `linker = "hoisted"` when using `better-dx`
- Environment variables are loaded automatically by Bun
- The preloader runs before the application starts
