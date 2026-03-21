---
name: stacks-path
description: Use when working with file paths in a Stacks application — resolving paths, joining paths, or getting framework-specific directory paths. Covers the @stacksjs/path package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Path

The `@stacksjs/path` package provides path manipulation utilities for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/path/src/`
- Package: `@stacksjs/path`

## Features
- Framework-aware path resolution
- Path joining and normalization
- Directory path helpers for all framework locations
- Cross-platform path handling

## Key Framework Paths
- Project root: resolved from working directory
- Framework: `storage/framework/`
- Core packages: `storage/framework/core/`
- Config: `config/`
- App: `app/`
- Database: `database/`
- Routes: `routes/`
- Public: `public/`
- Resources: `resources/`

## Usage
```typescript
import { resolve, join, frameworkPath, appPath } from '@stacksjs/path'
```

## Gotchas
- Always use `@stacksjs/path` instead of Node's `path` module for framework paths
- Path helpers know about the Stacks directory structure
- Paths are resolved relative to the project root
- This is a dependency of many other packages
