---
name: stacks-registry
description: Use when working with the Stacks package registry — registering packages, managing package discovery, or the registry system. Covers the @stacksjs/registry package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Registry

The `@stacksjs/registry` package provides a registry system for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/registry/src/`
- Discovered packages: `storage/framework/discovered-packages.json`
- Package: `@stacksjs/registry`

## Purpose
- Package discovery and registration
- Manages the discovered packages manifest
- Auto-discovers workspace packages
- Provides package metadata resolution

## Key Files
- `storage/framework/discovered-packages.json` - Auto-generated manifest of discovered packages

## Gotchas
- The discovered-packages.json is auto-generated — do not edit manually
- Registry works with the monorepo workspace system
- Package discovery runs during build and setup processes
