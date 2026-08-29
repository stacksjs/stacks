---
name: stacks-desktop
description: Use when building or publishing desktop applications with Stacks - Craft native windows, system tray, desktop packaging, or Mac App Store delivery.
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

Craft is normally installed through pantry and resolved from PATH. Set
`CRAFT_BIN` to an explicit compiled native binary in CI or local Craft
development. When testing local SDK source as well, set `CRAFT_SDK_SRC` to its
`src/index.ts` entry. Set `STACKS_NO_NATIVE=1` only when a deliberately web-only
dashboard process is required, such as headless browser QA. A missing
`CRAFT_BIN` is an error and is never treated as a headless flag.

Native development windows load the dashboard through its loopback HTTP
origin. Keep pretty HTTPS domains for browser access. WKWebView does not assume
that a developer's local certificate authority is trusted, and a failed TLS
navigation otherwise appears as a blank native window.

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

## Local-first apps: owning the launcher

The launcher Stacks compiles opens a Craft window on the URL in `desktop.json`,
which is what a hosted Stacks application wants. An app whose subject is the
machine it runs on — a disk cleaner, a log viewer, a device tool — has no such
URL: it starts something locally and opens a window on that, on a port it does
not know until launch.

Write `app/Desktop/launcher.ts` and `build:desktop` compiles that instead, the
same way anything under `app/` overrides its framework default. `DESKTOP_URL`
and `APP_URL` then become optional, because the launcher decides what to open.

```ts
// app/Desktop/launcher.ts — compiled to Contents/MacOS/<AppName>
import { dirname, join } from 'node:path'

const macos = dirname(process.execPath)          // siblings live here
const server = Bun.spawn([join(macos, 'my-agent')], { stdout: 'pipe' })
const port = await readPortFrom(server.stdout)   // the agent picks a free one

const craft = Bun.spawn([
  join(macos, 'craft-runtime'),
  `http://127.0.0.1:${port}`,
  '--title', 'My App',
], { stdout: 'inherit' })

process.exit(await craft.exited)
```

Two things follow from declaring your own launcher:

- **Every file `build:desktop` leaves in `storage/framework/desktop-dist` is
  copied into `Contents/MacOS`.** Compile the sibling binaries your launcher
  spawns into that directory and they ship with it.
- **`app/Desktop/Resources/` is copied into `Contents/Resources`.** A
  prerendered UI, a schema, seed data — a local-first app has a payload, and
  this is where it goes.

`build:dmg` also narrows App Transport Security for these bundles: an exception
for `127.0.0.1` rather than `NSAllowsArbitraryLoads`, which would additionally
permit every unencrypted host on the internet.

### Info.plist entries

`app/Desktop/Info.plist.json` is merged into the generated `Info.plist`. The
entries that matter most are the `NS*UsageDescription` strings — they are the
sentences a person reads when macOS asks whether your app may look in their
Downloads folder or drive Finder, and without them the prompt is generic or the
request is refused outright.

```json
{
  "LSApplicationCategoryType": "public.app-category.utilities",
  "NSDownloadsFolderUsageDescription": "MyApp scans your Downloads for large files.",
  "NSAppleEventsUsageDescription": "MyApp asks Finder to move items to the Trash so deletions stay recoverable."
}
```

JSON, not XML: a malformed plist produces a bundle macOS silently refuses to
launch, which surfaces long after the build reported success. Strings, numbers,
booleans, arrays, and nested objects all render.

Keys the bundle must own — `CFBundleIdentifier`, `CFBundleExecutable`,
`CFBundleVersion`, and the rest of the identity — are ignored with a note.
Rewriting those produces a bundle that does not match what was signed.

Inside the bundle the launcher is named after the app, not `stacks-desktop`.
macOS names the *process* in every permission prompt, so a launcher keeping the
framework's build name asks "stacks-desktop would like to access files in your
Downloads folder" — which reads like something to refuse.

Application data belongs in `~/Library/Application Support/<AppName>`, never
inside the bundle — `/Applications` is not writable by the user, and the bundle
is replaced wholesale on update.

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
