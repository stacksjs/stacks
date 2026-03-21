---
name: stacks-browser
description: Use when working with browser/frontend functionality in a Stacks application — DOM utilities, browser APIs, client-side features, or frontend integration. Covers the @stacksjs/browser package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Browser

The `@stacksjs/browser` package provides frontend/browser functionalities for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/browser/src/`
- Auto-imports: `storage/framework/browser-auto-imports.json`
- Package: `@stacksjs/browser`

## Purpose
- Provides browser-specific utilities and APIs
- Integrates with the STX templating system
- Manages client-side state and interactions
- Handles browser auto-imports for development

## Auto-Imports
The framework auto-imports browser utilities defined in `storage/framework/browser-auto-imports.json`, making them available without explicit imports in STX templates.

## Gotchas
- Browser code must be compatible with STX templates
- Do NOT use vanilla JS (`var`, `document.*`, `window.*`) in STX templates
- Use STX-compatible code (signals, composables, directives) instead
- Browser utilities are separate from server-side code
- The `@stacksjs/composables` package provides reactive browser features
