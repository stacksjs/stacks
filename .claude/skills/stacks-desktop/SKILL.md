---
name: stacks-desktop
description: Use when building desktop applications with Stacks — configuring the desktop engine, creating desktop-specific features, or packaging for desktop. Covers the @stacksjs/desktop package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Desktop

The `@stacksjs/desktop` package provides desktop application engine for Stacks.

## Key Paths
- Core package: `storage/framework/core/desktop/src/`
- Package: `@stacksjs/desktop`

## Features
- Desktop application packaging
- Native desktop features integration
- System tray support
- Desktop-specific views and layouts

## Desktop Views
Default desktop views are in `storage/framework/defaults/views/system-tray/`.

## Related
- System tray router types: `storage/framework/types/system-tray-router.d.ts`
- Desktop layouts: `storage/framework/defaults/layouts/system-tray/`

## Gotchas
- Desktop builds require platform-specific compilation
- System tray views use STX templates
- Desktop routing has its own type definitions
