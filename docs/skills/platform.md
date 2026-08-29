---
title: "Platform skills"
description: "Config, env, dependencies, auto-imports, paths and types."
---
# Platform

Config, env, dependencies, auto-imports, paths and types.

The layer under the application: configuration, environment, dependency
management, auto-imports, path resolution and generated types.

9 skills.

| Skill | What it is for |
|---|---|
| [Alias](/skills/platform/alias) | The 260+ path mappings that let `@stacksjs/*` resolve across the framework, and what to check when an import will not resolve. |
| [Auto-imports](/skills/platform/auto-imports) | What is available without an import, which differs between browser and server, and the manifests and generated declarations that decide it. |
| [Config](/skills/platform/config) | The ~44 typed config files, the `defineX()` builder functions behind them, the defaults, and how environment-specific overrides resolve. |
| [Configuration](/skills/platform/configuration) | Project-level setup rather than feature config: the `bunfig.toml` preload order, the tsconfig chain and tsgo type checking, workspaces, `.env`, the package scripts and the system requirements. |
| [Dependencies](/skills/platform/dependencies) | Managing dependencies: system dependencies through Pantry, Bun workspaces, buddy-bot updates and the shared `better-dx` tooling. |
| [Enums](/skills/platform/enums) | The framework's enumerated constants, used across the build system, the CLI and the actions. |
| [Env](/skills/platform/env) | The typed env proxy with automatic coercion, `.env` loading, encryption and decryption of individual values, runtime and CI detection, and the `buddy env:*` commands. |
| [Path](/skills/platform/path) | The 100+ framework-aware path builders, one per directory in the project, plus the standard path utilities. |
| [Types](/skills/platform/types) | The generated and hand-written type definitions: model types, request types, environment variables, event types and the ambient globals. |

Every page here describes one `SKILL.md` under
[`storage/framework/defaults/ai/skills`](https://github.com/stacksjs/stacks/tree/main/storage/framework/defaults/ai/skills).
See [Using skills](/skills/using) to wire them into your agent.
