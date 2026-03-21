---
name: stacks-shell
description: Use when working with shell utilities in a Stacks project — shell commands, terminal integration, or Oh My Zsh improvements. Covers the @stacksjs/shell package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Shell

The `@stacksjs/shell` package provides shell improvements and utilities for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/shell/src/`
- Package: `@stacksjs/shell`

## Features
- Shell command execution helpers
- Oh My Zsh integration
- Terminal output formatting
- Process management utilities

## Usage
```typescript
import { exec, spawn } from '@stacksjs/shell'
```

## Gotchas
- Shell utilities are for server-side use only
- For CLI output formatting, use `@stacksjs/cli`
- Shell commands run in the server environment
