# Build a Desktop App

Stacks desktop applications use [Craft](https://github.com/home-lang/craft), the first-party native runtime shared by the dashboard and system tray. Your UI remains stx, your HTTP routes remain Stacks routes, and the native window opens the same pretty HTTPS URL that rpx and tlsx provide to the browser.

## Prerequisites

- Bun 1.3 or newer
- A working Stacks project
- Craft built in `~/Code/Tools/craft`, or `CRAFT_BIN` set to a native Craft binary

Run the framework checks before opening a native window:

```bash
buddy doctor
```

## Start the native application

```bash
buddy dev:desktop
```

This starts the dashboard stx server and opens it in Craft. A direct desktop run starts rpx and tlsx for the configured application domain, so the native window uses a URL such as `https://dashboard.my-app.test`. If another `buddy dev` process already manages the proxy, the desktop process reuses it.

Use the general development command when you want the web application and API too:

```bash
buddy dev
```

## Build a desktop distribution

Set the deployed application URL, then build:

```bash
APP_URL=https://app.example.com buddy build:desktop
```

The build creates `storage/framework/desktop-dist/` with:

- `stacks-desktop`, the compiled application launcher
- `craft-runtime`, the native Craft runtime
- `desktop.json`, the window and application manifest

`DESKTOP_URL` overrides `APP_URL` when the desktop application should target a separate host.

## Desktop API

The `@stacksjs/desktop` package owns Craft launch configuration.

```typescript
import {
  createInviteLink,
  createUpdateManifestUrl,
  openDevWindow,
} from '@stacksjs/desktop'

await openDevWindow(3000, {
  url: 'https://app.example.test',
  title: 'Example',
  width: 1280,
  height: 820,
  darkMode: true,
})

const invite = createInviteLink('https://app.example.com', token, {
  email: 'person@example.com',
  team: 'product',
  role: 'editor',
  expiresAt: new Date('2026-08-01T00:00:00Z'),
})

const updateManifest = createUpdateManifestUrl('https://app.example.com')
```

Craft exposes native APIs to the webview through its typed bridge. Keep bridge access in a TypeScript function or composable, then call that function from the stx page.

```typescript
interface CraftWindowBridge {
  minimize(): Promise<void>
  toggle(): Promise<void>
}

export async function minimizeDesktopWindow(): Promise<void> {
  const craft = (globalThis as typeof globalThis & {
    craft?: { window?: CraftWindowBridge }
  }).craft

  await craft?.window?.minimize()
}
```

```stx
<script client>
import { minimizeDesktopWindow } from '~/resources/functions/desktop'
</script>

<button type="button" @click="minimizeDesktopWindow()">
  Minimize
</button>
```

The Craft bridge includes window control, files, notifications, clipboard, processes, shortcuts, tray menus, native sidebars, and update primitives. Keep permissions narrow and expose only the operations the page needs.

## System tray

Stacks includes a complete Craft system tray application:

```bash
buddy dev:system-tray
```

It discovers projects under `~/Code`, installs a native nested menu, and provides shortcuts for:

- refreshing project discovery
- opening a project Terminal
- running `buddy doctor`
- opening dashboard settings
- checking dependency updates
- copying the local IP address
- listing Buddy commands
- opening deployment, site, and error logs
- editing `.env`, DNS, and email configuration
- opening Ask Buddy
- starting a confirmed deployment

The tray uses `https://tray.<app-domain>` through rpx and tlsx by default. Host operations are allowlisted by the tray server, and destructive operations require confirmation.

## Settings

Desktop settings use the same dashboard settings workspace as the web dashboard:

```text
https://dashboard.<app-domain>/settings
```

The workspace discovers every `config/*.ts` file. Literal scalar values can be edited safely. Environment-backed expressions, arrays, and nested objects remain read-only so the editor never destroys comments or configuration logic.

## Updates

Craft supplies the native updater. Publish a signed manifest at the URL returned by `createUpdateManifestUrl()` and configure your release pipeline to produce per-platform checksums and signatures. Desktop builds disable development tools and include their update channel in the application manifest.

Use a stable HTTPS endpoint in production. Never fetch update metadata over plain HTTP.

## Debugging

Development windows enable Craft hot reload and developer tools by default. Use these dashboard surfaces for framework diagnostics:

- `/errors` for captured application errors
- `/requests` for HTTP activity
- `/queries` and `/queries/slow` for database activity
- `/logs` for application logs
- `/health` for system checks
- `/insights` for runtime metrics

Run command-line diagnostics alongside the native window:

```bash
buddy doctor
buddy ports:check
buddy route:list
```

## Distribution checklist

Before shipping:

1. Set a production `APP_URL` or `DESKTOP_URL`.
2. Run `buddy doctor`.
3. Run the relevant tests and `buddy lint`.
4. Run `buddy build:desktop`.
5. Launch the generated binary from `storage/framework/desktop-dist`.
6. Verify update signatures and checksums against a staging manifest.
7. Sign and notarize the native artifacts for each target platform.

Craft is the desktop engine. Do not add Tauri, Electron, or a second native runtime to a Stacks project.
