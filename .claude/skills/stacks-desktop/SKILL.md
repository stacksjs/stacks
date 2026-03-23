---
name: stacks-desktop
description: Use when building desktop applications with Stacks — Tauri integration, dev windows, system tray, or desktop-specific features. Covers @stacksjs/desktop (currently stubbed, Tauri integration pending).
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Desktop

## Key Paths
- Core package: `storage/framework/core/desktop/src/`
- Source: `storage/framework/core/desktop/src/index.ts`
- System tray views: `storage/framework/defaults/views/system-tray/`
- System tray layouts: `storage/framework/defaults/layouts/system-tray/`
- System tray router types: `storage/framework/types/system-tray-router.d.ts`
- Package: `@stacksjs/desktop`

## API

```typescript
import { openDevWindow } from '@stacksjs/desktop'
import type { Desktop, OpenDevWindowOptions } from '@stacksjs/desktop'

interface OpenDevWindowOptions {
  title?: string
  width?: number
  height?: number
  darkMode?: boolean
  hotReload?: boolean
  nativeSidebar?: boolean
  sidebarWidth?: number
  sidebarConfig?: unknown
}

async function openDevWindow(port: number, options?: OpenDevWindowOptions): Promise<boolean>
```

### Desktop Interface (Tauri API surface)

```typescript
interface Desktop {
  app: unknown
  core: unknown
  dpi: unknown
  event: unknown
  image: unknown
  menu: unknown
  mocks: unknown
  path: unknown
  tray: unknown
  webview: unknown
  webviewWindow: unknown
  window: unknown
}
```

## Current Status

**The Tauri integration is currently stubbed.** `openDevWindow()` returns `false` — the actual Tauri API calls are commented out pending implementation.

## CLI Commands

```bash
buddy dev:desktop       # Start desktop dev server
buddy build:desktop     # Build desktop application
```

## Related Files
- System tray views use STX templates in `storage/framework/defaults/views/system-tray/`
- System tray has its own router type definitions
- Desktop layouts in `storage/framework/defaults/layouts/system-tray/`

## Gotchas
- **Currently incomplete** — `openDevWindow()` is a stub that returns `false`
- **Tauri integration pending** — the Desktop interface maps to Tauri's API but imports are commented out
- **System tray is separate** — system tray views and routing have their own type definitions
- **Platform-specific builds** — desktop builds require platform-specific Tauri compilation
- **Dev window options exist but aren't functional** — `OpenDevWindowOptions` is defined but not yet wired to Tauri
