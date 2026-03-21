---
name: stacks-search-engine
description: Use when implementing search functionality in a Stacks application — full-text search, search indexing, or search provider configuration. Covers @stacksjs/search-engine and config/search-engine.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Search Engine

The `@stacksjs/search-engine` package provides search engine integrations for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/search-engine/src/`
- Configuration: `config/search-engine.ts`
- Package: `@stacksjs/search-engine`

## Features
- Full-text search integration
- Search indexing
- Search provider abstraction
- Query parsing and filtering

## CLI Commands
- `buddy search` - Search utility commands

## Gotchas
- Search configuration is in `config/search-engine.ts`
- Search integrates with the ORM for model indexing
- Provider configuration determines the search backend
