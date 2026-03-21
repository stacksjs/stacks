---
name: stacks-cli
description: Use when building CLI commands or tools with Stacks — creating commands, parsing arguments, formatting output, or building console applications. Covers the @stacksjs/cli package used to build the buddy CLI and custom commands.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks CLI Framework

The `@stacksjs/cli` package is a TypeScript CLI framework for building beautiful console applications, used internally by the buddy CLI.

## Key Paths
- Core package: `storage/framework/core/cli/src/`
- CLI configuration: `config/cli.ts`
- Application commands: `app/Commands/`
- Application commands config: `app/Commands.ts`
- Package: `@stacksjs/cli`

## Purpose
- Provides the foundation for the `buddy` CLI
- Enables creation of custom CLI commands in `app/Commands/`
- Offers argument parsing, option handling, and output formatting
- "Build beautiful console apps"

## Creating Custom Commands
1. Create a command file in `app/Commands/`
2. Define the command using `@stacksjs/cli` utilities
3. Register it in `app/Commands.ts`

## Usage
```typescript
import { command, option, argument } from '@stacksjs/cli'
```

## Gotchas
- Application commands go in `app/Commands/`, framework commands in `storage/framework/core/buddy/src/commands/`
- The CLI uses `@stacksjs/cli` for all output formatting
- Commands should follow conventional patterns (see existing commands for reference)
- CLI configuration is separate from buddy configuration
