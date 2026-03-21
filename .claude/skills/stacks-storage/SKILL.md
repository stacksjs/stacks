---
name: stacks-storage
description: Use when working with file storage in a Stacks application — reading/writing files, file uploads, cloud storage, or filesystem configuration. Covers @stacksjs/storage and config/file-systems.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Storage

The `@stacksjs/storage` package provides file system utilities for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/storage/src/`
- Configuration: `config/file-systems.ts`, `config/filesystems.ts`
- Storage directory: `storage/`
- Public directory: `public/`
- Package: `@stacksjs/storage`

## Features
- File read/write operations
- Directory management
- File upload handling
- Cloud storage integration
- MIME type detection

## Storage Directories
- `storage/` - Application storage (caches, logs, framework files)
- `storage/framework/` - Framework storage
- `storage/framework/cache/` - Cache files
- `public/` - Publicly accessible files

## Configuration
- `config/file-systems.ts` - File system drivers and settings
- `config/filesystems.ts` - Alternative config path

## Gotchas
- Two config files exist: `file-systems.ts` and `filesystems.ts`
- Storage is a dependency of many framework packages
- Public files go in `public/`, not `storage/`
- Cloud storage requires provider configuration
