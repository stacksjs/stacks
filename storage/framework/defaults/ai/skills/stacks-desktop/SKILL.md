---
name: stacks-desktop
description: Use when building or publishing desktop applications with Stacks — Craft native windows, system tray, desktop packaging, or Mac App Store delivery.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Desktop

## Key Paths
- Core package: `storage/framework/core/desktop/src/`
- Source: `storage/framework/core/desktop/src/index.ts`
- System tray views: `storage/framework/defaults/views/system-tray/`
- System tray layouts: `storage/framework/defaults/resources/layouts/`
- Package: `@stacksjs/desktop`

## Runtime

Stacks desktop applications use the native [Craft](https://github.com/home-lang/craft)
runtime. `buddy dev:desktop` hosts the dashboard/application and opens it in a
Craft window. `buddy build:desktop` compiles a small Stacks launcher and places
the launcher, pinned Craft runtime, manifest, provenance, and checksums in
`storage/framework/desktop-dist`.

Set `CRAFT_BIN` to an executable Craft binary in CI or when Craft is not checked
out at `~/Code/Tools/craft`.

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

### Desktop Interface

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

## CLI Commands

```bash
buddy dev:desktop              # start the desktop development server
buddy build:desktop            # build the launcher + Craft runtime payload
buddy desktop:apple:init       # generate the reusable GitHub Actions caller
buddy desktop:apple:doctor     # validate Apple tooling, identities, profile, and API key
buddy desktop:apple:package    # build, sandbox, sign, and create a Store .pkg
buddy desktop:apple:publish    # validate or upload the package to App Store Connect
```

## Mac App Store

Run `buddy desktop:apple:init`, then configure the repository variables and
secrets named by the generated workflow. The reusable Stacks workflow builds
Craft from an immutable revision, imports signing material into an ephemeral
keychain, embeds the provisioning profile, applies App Sandbox entitlements,
signs the helper before the parent app, creates a signed installer package, and
uses App Store Connect API-key authentication for validation/upload.

Start with `validate-only: true`. Upload only after the signed artifact passes
local launch and UI QA.

Human-owned prerequisites that Buddy does not pretend to automate:

- Apple Developer Program enrollment and agreement acceptance
- App Store Connect API access approval and initial key download
- banking, tax, pricing, privacy, age rating, and export-compliance answers
- final App Review submission/release policy

## Required Apple configuration

Repository variables:

- `APPLE_APP_NAME`
- `APPLE_BUNDLE_ID`
- `APPLE_TEAM_ID`
- `DESKTOP_URL`
- `APPLE_APP_SIGNING_IDENTITY`
- `APPLE_INSTALLER_SIGNING_IDENTITY`

Repository secrets:

- `APPLE_APP_CERTIFICATE_BASE64`
- `APPLE_INSTALLER_CERTIFICATE_BASE64`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_PROVISIONING_PROFILE_BASE64`
- `APP_STORE_CONNECT_API_KEY`
- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_API_ISSUER_ID`

## Gotchas
- App Store packaging runs on macOS with Xcode command-line tools.
- The embedded Craft runtime must inherit the parent App Sandbox.
- A Mac App Distribution identity and Mac Installer Distribution identity serve different signing steps.
- The provisioning profile must match the team ID, bundle ID, and requested entitlements.
- App Store upload is not notarization. Outside-Store distribution uses Developer ID signing and notarization instead.
- A Store build number is immutable. Retry upload with the same signed artifact; rebuild with a new number only when the binary changes.
