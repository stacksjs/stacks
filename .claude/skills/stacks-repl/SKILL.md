---
name: stacks-repl
description: Use when using the Stacks REPL (Read-Eval-Print Loop) — interactive TypeScript sessions, debugging, or exploring the framework interactively. Covers @stacksjs/repl and @stacksjs/tinker.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks REPL / Tinker

The `@stacksjs/repl` and `@stacksjs/tinker` packages provide interactive TypeScript REPL sessions.

## Key Paths
- REPL package: `storage/framework/core/repl/src/`
- Tinker package: `storage/framework/core/tinker/src/`
- Packages: `@stacksjs/repl`, `@stacksjs/tinker`

## CLI Commands
- `buddy tinker` - Start an interactive REPL session

## Features
- Interactive TypeScript execution
- Access to all Stacks packages and models
- Database queries in real-time
- Framework-aware autocompletion

## Gotchas
- Tinker is the user-facing command, REPL is the underlying engine
- All framework imports are available in the REPL
- REPL sessions have access to the application context
- Use tinker for debugging and data exploration
