---
name: stacks-desktop
description: Use when building or publishing desktop applications with Stacks - Craft native windows, web view apps on a local agent for macOS, Windows and Linux, local launchers, helper processes, packaging, signed auto-updates, capability probes, or Mac App Store delivery. Covers @stacksjs/desktop-build and the browser bridge boundary.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Desktop

## Key Paths
- Core package: `storage/framework/core/desktop/src/`
- Web view apps: `webview-agent.ts`, `webview-launcher.ts`, `webview-app.ts`; updates: `updater.ts`, `update-signing.ts`, `update-feed.ts`, `update-install.ts`
- Build and release actions: `storage/framework/core/actions/src/build/desktop-webview.ts`, `desktop-release.ts`
- Update feed: `storage/framework/defaults/app/Actions/Desktop/UpdateFeedAction.ts`, `defaults/routes/desktop-updates.ts`
- Source: `storage/framework/core/desktop/src/index.ts`
- System tray views: `storage/framework/defaults/views/system-tray/`
- System tray layouts: `storage/framework/defaults/resources/layouts/`
- Build/host package: `@stacksjs/desktop-build`
- Browser bridge package: `@stacksjs/desktop/browser` (from the STX ecosystem)

## Runtime

For offline native projects (`stacks.type: native`), Buddy compiles the app and
Pantry owns runtime provisioning and distribution. Declare immutable runtime
pins, entitlements, native checks and publishing targets in `pantry.json.native`.
Buddy uses `ts-pantry/native` to provision Craft with its locked compiler and
first-party pins and to prepare signing inputs. Keep `craft.config.ts` for app
metadata and UI. Do not scaffold app-specific runtime scripts, entitlement XML,
keychain scripts, notarization commands or store-upload workflows. Use Pantry's
versioned `.github/workflows/native-app.yml` reusable workflow for checks and
releases. New/adopted native apps also use Buddy-encrypted `.env.production`,
with `.env.keys` ignored and only `DOTENV_PRIVATE_KEY_PRODUCTION` passed to
release Actions. Native `buddy release --bump patch|minor|major` delegates
qualification and versioning to Pantry; the tag invokes its delivery workflow.
`CRAFT_BIN` remains a local development override; release pipelines
require the declared immutable runtime.

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

Two packages carry "desktop" in their name. `@stacksjs/desktop-build` (this
repo, `storage/framework/core/desktop`) holds the build and launch helpers
below. `@stacksjs/desktop` (the stx repo) wraps the Craft bridge for code
running inside the window; import it from `@stacksjs/desktop/browser` there,
since its root entry also carries host-side modules that pull in Node builtins
and fail a browser bundle. Attic (`~/Code/Apps/attic`) uses it for native
menus, context menus and alerts.

```typescript
import { openDevWindow } from '@stacksjs/desktop-build'
import type { Desktop, OpenDevWindowOptions } from '@stacksjs/desktop-build'

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

### Model-backed offline native apps

An app created with `buddy new <name> --native` can use `craft.config.ts`'s
`backend: { entry: 'app/Desktop/api.ts' }` to bundle a Bun backend. The native
host owns an authenticated ephemeral loopback session and the backend's lifetime.
The binary does not need an installed Bun, external server or source files.

Define models under `app/Models` with `defineModel` from `@stacksjs/orm/define-model`.
In the backend, import those models explicitly and use `openNativeDatabase` and
`createNativeModelApi` from `@stacksjs/orm/native`. Pass an absolute SQLite path
inside Application Support and an explicit model registry. The same query-builder
migration planner derives the schema and atomically records its snapshot in the
database. Additive upgrades preserve rows; destructive changes are refused.

CRUD follows `traits.useApi.uri` and its explicit `routes` list. Native models
declare `middleware: []` because the transport owns session authorization.
`createNativeModelApi` requires an `authorize(request, model, ability)` callback
on every request. Only return true unconditionally when the handler runs solely
behind stx's authenticated native backend. Never expose that handler through an
unprotected HTTP server. Web middleware declarations are refused by this native
adapter instead of silently skipped. Writes use the model's validation, fillable
allowlist and hidden-field serialization; index requests have bounded pagination.

The launcher Stacks compiles opens a Craft window on the URL in `desktop.json`,
which is what a hosted Stacks application wants. An app whose subject is the
machine it runs on - a disk cleaner, a log viewer, a device tool - has no such
URL: it starts something locally and opens a window on that, on a port it does
not know until launch.

Write `app/Desktop/launcher.ts` and `build:desktop` compiles that instead, the
same way anything under `app/` overrides its framework default. `DESKTOP_URL`
and `APP_URL` then become optional, because the launcher decides what to open.

Every launcher, the framework's or yours, compiles through
`desktopLauncherCompileArgs()` to bytecode as an ES module: parsing the bundle
was most of a launcher's start (Browser's agent reached its window host in
379 ms as source, 146 ms as bytecode), for an executable about a quarter
larger. Pass `bytecode: false` only to compare. Compile any helper binary of
your own with the same function rather than hand-written `bun build` flags.

```ts
// app/Desktop/launcher.ts - compiled to Contents/MacOS/<AppName>
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
  prerendered UI, a schema, seed data - a local-first app has a payload, and
  this is where it goes.

`build:dmg` also narrows App Transport Security for these bundles: an exception
for `127.0.0.1` rather than `NSAllowsArbitraryLoads`, which would additionally
permit every unencrypted host on the internet.

### Info.plist entries

`app/Desktop/Info.plist.json` is merged into the generated `Info.plist`. The
entries that matter most are the `NS*UsageDescription` strings - they are the
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

Keys the bundle must own - `CFBundleIdentifier`, `CFBundleExecutable`,
`CFBundleVersion`, and the rest of the identity - are ignored with a note.
Rewriting those produces a bundle that does not match what was signed.

Inside the bundle the launcher is named after the app, not `stacks-desktop`.
macOS names the *process* in every permission prompt, so a launcher keeping the
framework's build name asks "stacks-desktop would like to access files in your
Downloads folder" - which reads like something to refuse.

Application data belongs in `~/Library/Application Support/<AppName>`, never
inside the bundle - `/Applications` is not writable by the user, and the bundle
is replaced wholesale on update.

## Helper processes: one binary, not three

An app that owns its launcher usually needs more than the launcher - an agent
serving on loopback, a worker doing something slow out of process. Compile each
as its own binary and the bundle gets very large very quietly.

`bun build --compile` embeds the entire Bun runtime in **every** executable it
writes. `console.log("hi")` measures **60.5 MB**. So three binaries means three
copies of the same runtime, and nothing says so - the bundle is simply big, and
a big desktop app looks unremarkable. One real app shipped 230 MB this way, of
which about 180 MB was the runtime repeated; its own code plus the native Craft
runtime came to under 40 MB.

Compile **one** binary and dispatch on a subcommand. The helpers stay separate
*processes* - which is what actually matters for isolation and for killing one
that wedges - they just stop being separate *files*.

```ts
// app/Desktop/launcher.ts - before anything else at module scope
const subcommand = process.argv[2]

if (subcommand === 'agent' || subcommand === 'scan') {
  if (subcommand === 'agent') {
    const { runAgent } = await import('./server')
    await runAgent()
  }
  else {
    const { runScannerCli } = await import('../Workers/scan')
    await runScannerCli(process.argv[3] ?? '')
  }

  // Park. Everything below is the launcher, and a subcommand reaching it would
  // spawn a second agent and open a second window.
  await new Promise(() => {})
}
```

Then spawn `process.execPath` instead of a sibling path:

```ts
const agent = Bun.spawn([process.execPath, 'agent'], { stdout: 'pipe' })
```

Two things that bite, both silently:

- **The dispatch must come first.** A launcher's body is top-level code that
  starts a server and opens a window as a side effect of loading.
- **Do not `process.exit()` after starting a server.** A `runAgent()` that
  returns once `Bun.serve` is listening has not finished - `Bun.serve` is what
  holds the process open. Exiting after it kills the agent one line after it
  printed the port the launcher is still waiting for, and the launcher reports
  a timeout that says nothing about the cause.

`buddy build:dmg` warns when a finished bundle contains more than one
Bun-compiled executable, naming them and what the repetition costs.

## Native macOS apps (`config/desktop.ts`)

A project whose app is a client of an HTTP API (a hosted service, not a local server) declares it in
`config/desktop.ts`, the way `config/mobile.ts` declares a phone app, and `buddy build:desktop` builds a
native AppKit app from its stx screens: no web view, no launcher.

```ts
import type { DesktopConfig } from '@stacksjs/types'

export default {
  macos: {
    appName: 'Library',
    bundleId: 'com.example.library',
    teamId: '3JJRNQW6B7',                 // not a secret
    url: process.env.LIBRARY_API_URL || 'http://127.0.0.1:3408',
    nativeScreens: ['Main', 'Settings'],   // resources/native/<name>.stx
    shareStorage: { auth_token: 'auth.token' },
    window: { width: 1180, height: 760, minWidth: 860, minHeight: 540 },
    icon: 'resources/native/icon/AppIcon-1024.png',
    privacy: { tracking: false, collectedDataTypes: [] },
  },
} satisfies DesktopConfig
```

- `buddy build:desktop` compiles the screens (`compileNativeBundle`), builds Craft's AppKit host
  (`craft-native/macos`, cached per Craft revision), lays out `<App>.app` and signs it ad hoc. `buddy dev:desktop`
  does the same and opens it. Output: `storage/framework/desktop/macos/`.
- The toolchain is not the app's business: Craft resolves the pinned Zig through Pantry and fetches and builds the pinned
  zig-js into `~/.cache/craft/toolchain` (`CRAFT_TOOLCHAIN_DIR` moves it, `CRAFT_ZIG` overrides the compiler).
- The host reads `Contents/Resources/craft-app.json` (written by the build) when Finder launches it, so the app has no
  arguments. The API origin is `url`, and `craft.secureStorage` is the Keychain (`craft.session` is the `auth.token` item).
- `buddy desktop:apple:package` and `publish` build the same bundle for the Mac App Store (sandbox, network client,
  application identifier, Keychain group, embedded profile). Name, bundle id, team, version, category and icon come
  from `config/desktop.ts`; only the credentials (identities, profile, API key) are Apple variables. `--universal` is not
  supported for native apps yet.
- A `macos` section in `config/desktop.ts` switches `build:desktop` and `dev:desktop` to this path; without one they
  build the Craft web-view app as before.
- One set of views can be both: the web server resolves the native primitives (`View`, `Text`, `ScrollView`, ...) as
  components of last resort (stx config `nativePrimitives`), so `resources/views` pages written with them are also native
  screens. Menus, windows and the Keychain are the screen's `craft.desktop` and `craft.secureStorage`.

### An app that runs its own API (`macos.agent`)

A local-first app (a browser, an inbox, anything whose data is this Mac) runs the project's routes inside the
app instead of talking to a hosted server. `buddy new <name> --desktop` scaffolds one (combinable with
`--minimal`, and happy to scaffold into a directory that holds only `.git`):

```ts
export default {
  macos: {
    appName: 'Browser',
    bundleId: 'com.example.browser',
    agent: true,                     // or { port, entry, appRoutes, staticDir, resources }
    nativeScreens: ['Main'],
    webkit: true,                    // link WebKit into the host, for <WebView>
    defaultBrowser: true,            // http/https URL types, HTML/XHTML/webarchive/PDF document types
    permissions: { camera: true, microphone: 'For calls in web pages.', location: true, downloads: true, printing: true },
    dockMenu: [{ title: 'New Window', action: 'new-window' }],
  },
} satisfies DesktopConfig
```

- The agent (`@stacksjs/desktop-build` `startDesktopAgent`, `src/agent.ts`) is `Bun.serve` on 127.0.0.1, on the
  port remembered in `~/Library/Application Support/<App>/agent.port` (any free port when it is taken). The host fetches
  `GET /native/session` and gets an HttpOnly, SameSite=Strict cookie holding a token minted for this launch; every other
  request needs that cookie and a Host header of `127.0.0.1:<port>` or `localhost:<port>`, so a DNS-rebinding page
  cannot call it. `url` is not needed.
- It serves the app's routes in process: `routes/` as `app/Routes.ts` mounts them, plus the agent's own module
  (`app/Desktop/Agent.ts` by convention, `agent.entry` otherwise). Routes the agent module adds are not prefixed. A
  default-exported `(request) => Response` there replaces the router entirely.
- `buddy dev:desktop` runs the launcher from source in the project (`bun`, no bundle), which boots the routes as
  `buddy dev:api` does. `buddy build:desktop` compiles the launcher into `<App>.app/Contents/MacOS/<App>`, with the host
  beside it as `craft-runtime` and `desktop-agent.json` in Resources. A compiled binary cannot import route files off
  disk (the router refuses), so the build imports the registry's route files, the agent module and every
  `'Actions/...'` they name statically (`provideActions`); what they import travels inside the app.
- A compiled agent has no `node_modules`, so a package that reads data files beside its own modules (rule lists, a
  word list) finds nothing. Name them in `agent.resources`, `{ lists: 'node_modules/some-lib/data' }`: the build copies
  each into `Contents/Resources/<name>`, and a route finds it with `desktopResource('lists')` from
  `@stacksjs/desktop-build`, which under `buddy dev:desktop` is the path in the project. A route can pass that to the
  package (`{ dir: desktopResource('lists') }`). Names are plain file names, not `web` or the files the build writes.
- The launcher (`src/agent-launcher.ts`) holds a single-instance lock (`agent.pid`), logs to
  `~/Library/Logs/<App>.log` when launched without a terminal, and quits with the window.
- Entitlements: the Bun executable gets `allow-jit`, `allow-unsigned-executable-memory` and
  `disable-library-validation`; in the sandbox the agent adds `network.server`, and the host is signed with only
  `app-sandbox` and `inherit`. `permissions` adds each device entitlement and its `NS*UsageDescription` (an explicit
  `usageDescriptions` entry wins).
- `webkit` needs a craft-native whose `buildMacOSNative` takes `webkit`; the build checks Craft's source and fails by
  name rather than building a host with blank web views. `dockMenu` reaches the host through `craft-app.json`.

## Web view apps on a local agent (`desktop.webview`)

The cross-platform desktop mode: the app's executable is a compiled Bun agent on 127.0.0.1, and its window is a
Craft web view (WKWebView, WebView2, WebKitGTK) pointed at that agent. One codebase runs on macOS, Windows and
Linux. Choose it over `macos` (AppKit screens, macOS only, Mac App Store) when the app needs a web UI, more than
one platform, or child processes.

```ts
// config/desktop.ts
import type { DesktopConfig } from '@stacksjs/types'

export default {
  webview: {
    appName: 'Fettler',
    appId: 'org.fettler.app',                 // bundle id, package id, single-instance id
    window: { width: 1280, height: 800 },      // title defaults to appName
    agent: { entry: 'app/Desktop/Agent.ts', views: 'resources/desktop' },
    urlSchemes: ['fettler'],
    updates: { feedUrl: 'https://fettler.org/api/updates', publicKeys: { main: 'ed25519-public:...' } },
    runtime: { 'linux-x64': 'vendor/craft/linux-x64/craft' },   // Craft binaries for targets other than this machine
    macos: { entitlements: {} }, windows: { certificatePath: 'certs/app.pfx' }, linux: { categories: ['Development'] },
  },
} satisfies DesktopConfig
```

The agent module adds the app's own request handling. Returning nothing lets the views answer:

```ts
// app/Desktop/Agent.ts
import type { WebviewAgentModule } from '@stacksjs/desktop-build'

export default {
  fetch(request, context) {                    // context: appName, version, origin, port, dataDir
    if (new URL(request.url).pathname === '/api/run') return Response.json({ ok: true })
  },
  start({ launch, updater }) {},               // once, before the window opens; launch.args, launch.url
  secondInstance({ args, url, cwd }) {},       // another launch of the app, forwarded here
  beforeUpdate(manifest, current) {},          // return { refuse } or { warn } to gate an update
  stop() {},
} satisfies WebviewAgentModule
```

What the launcher (`runWebviewApp`) does, the same on every platform:

- **One instance.** A lock file in the data directory holds the pid, port and a secret. A second launch posts its
  arguments (and the link that started it, when it is in `urlSchemes`) to `/__desktop/instance` with that secret,
  the running agent's `secondInstance` gets them, and the second process exits without booting anything.
- **A remembered port.** Any free loopback port the first time, then the same one (`agent.port` file), so the
  page's origin and its local storage survive a restart. A taken port falls back to a free one.
- **A one-time token for a cookie.** The window opens on `/?session=<token>`. That request sets an HttpOnly,
  SameSite=Strict cookie and redirects to the same page without the token. The token works once and is not the
  cookie. Every later request needs the cookie.
- **A Host check.** Only `127.0.0.1:<port>` and `localhost:<port>` are answered, so a DNS-rebinding page cannot
  reach the agent. A request without the cookie gets 401, pages included.
- **A wider PATH.** `widenedPath()` puts `~/.local/bin`, `~/.bun/bin`, Homebrew and `/usr/local/bin` ahead of what
  the process was given (see the launchd trap below).
- **One lifetime.** Closing the window ends the agent (`stop()` runs, the lock is released); a signal to the agent
  closes the window. `craft.app.relaunch()` restarts the agent, not a bare window with a dead token.

`agent.publicPaths` opens paths to callers without the cookie (an MCP endpoint behind its own bearer token). The
app's handler must authenticate those itself; the views are never served there.

**Views.** `buddy dev:desktop` serves `agent.views` live through stx (`bun-plugin-stx/serve`, with the gate and the
agent module in its `onRequest`). `buddy build:desktop` builds them to static pages with stx's `buildStaticSite`
and compiles every file into the agent, so a built app reads no loose view files. Component directories for the
build come from the project's `stx.config.ts`; `agent.components` applies to the live server. A project that needs
its own view build puts it in `app/Desktop/build-views.ts` and writes to `DESKTOP_VIEWS_OUT`.

**Files the agent needs at runtime** are imported the Bun way, so they are compiled in on every platform:
`import data from './data.json' with { type: 'file' }`.

### Processes live in the agent

Spawn `bun`, `git`, `ssh`, `docker`, a language server, anything process-shaped, from the agent module, and stream
to the page over `fetch` bodies or a WebSocket. Do not spawn from the page through the Craft bridge:

- Craft's `shell.spawn` inherits stdio and discards output; `shell.exec` blocks the UI thread. Neither streams.
- The page holds no credentials. Keep tokens in the agent (`Bun.secrets` for the OS keychain).
- The same agent code runs on all three platforms; a bridge call has to exist on each.

### Building

```bash
buddy dev:desktop                                  # run from source, stx views live
buddy build:desktop                                # this machine's target
buddy build:desktop --target linux-x64,win32-x64   # cross-compile the agents
buddy build:desktop --target all --package         # also make the installers this OS can make
```

Output goes to `storage/framework/desktop/webview/<target>/`, with `build.json` listing every artifact.

| Target | What the build makes | Needs its own OS for |
|---|---|---|
| `darwin-*` | `<App>.app`: the agent as the executable, `craft-runtime` beside it, hardened runtime | Everything past the compiled agent: `codesign`, `notarytool`, `hdiutil` are macOS only |
| `win32-*` | `<App>.exe`, `craft-runtime.exe`, `windows.additionalFiles`, and `craft-package.json` | The MSI (WiX `candle` and `light`) and `signtool` |
| `linux-*` | One binary with Craft compiled into it, and `craft-package.json` | AppImage (`appimagetool`), deb (`dpkg-deb`), rpm (`rpmbuild`) |

Bun cross-compiles the agent for any target from any machine (`--target=bun-windows-x64`), so a Mac produces the
Windows and Linux executables. It does not produce their installers. `craft-package.json` is the input to Craft's
`packageApp`, with paths relative to its own folder; `--package` runs it when the machine matches the target.

Each target needs that platform's Craft web view binary: this machine's comes from `CRAFT_BIN` or `craft` on PATH,
every other from `webview.runtime['<target>']` or `CRAFT_BIN_<PLATFORM>_<ARCH>` (Craft publishes
`craft-<os>-<arch>.zip` with each release). On Linux the runtime is compiled into the agent and unpacked to the data
directory on first launch, because Craft's Linux packagers take one binary.

### Updates

An update is one manifest per channel, platform and architecture, signed with Ed25519. The app carries the public
key; the private key stays with the releaser and never reaches the server.

```bash
buddy desktop:update:keypair          # prints both halves once; nothing is written
# public half  -> webview.updates.publicKeys in config/desktop.ts
# private half -> DESKTOP_UPDATE_PRIVATE_KEY (a password manager or a CI secret)

buddy release:desktop --identity "Developer ID Application: Example (ABCDE12345)" --notary-profile example
buddy release:desktop --target linux-x64 --skip-build    # installers built on another machine
buddy release:desktop --dry-run                          # no notarization, no upload; manifests written locally
```

`release:desktop` checks everything that can refuse a release before it notarizes or uploads anything: a clean
tree at the built commit, a private key whose public half the config trusts, a version newer than what the channel
serves. Then per target:

- **macOS**: the `.app` must be signed with a Developer ID. It is notarized and stapled, zipped with `ditto` (what
  an installed app updates from) and imaged into a signed, notarized DMG (what a person downloads).
  `codesign --verify`, `spctl` and `stapler validate` run against the files that get uploaded.
- **Windows**: the MSI from `build:desktop --package` on Windows. With `windows.certificatePath` and
  `DESKTOP_WINDOWS_CERTIFICATE_PASSWORD`, the executables are signed with `signtool` and Craft signs the MSI.
- **Linux**: the AppImage (what an installed app updates from), with the deb and rpm beside it.

Artifacts and manifests go through `@stacksjs/storage` to `updates.disk` under `updates.prefix`
(`desktop-updates/<channel>/<platform>-<arch>/latest.json`, artifacts under `<version>/`), plus a `release.json`
a download page can read.

The server side is one default action, `Actions/Desktop/UpdateFeedAction`, mounted at
`/api/updates/{platform}/{arch}` whenever `webview.updates` is configured. It serves the stored manifest as is
(204 when `?current=` is already that version, 404 when nothing was published). Override the action in
`app/Actions/Desktop/UpdateFeedAction.ts`, or mount it elsewhere in `routes/api.ts`.

In the app, the launcher checks once the window is up and every `updates.checkEveryHours` (default 24). The page
drives it at `/__desktop/update` (cookie required): `GET` is the status, `POST { action: 'check' }` asks the feed,
and `POST { action: 'install', acknowledge? }` installs. Installing verifies the manifest signature, the size and
the SHA-256, then:

| Installed as | Install step |
|---|---|
| macOS `.app` | Unpack beside the bundle, check the new bundle's signature, team and identifier against the running app, swap by rename (the old bundle is put back on failure), relaunch through `open` |
| Windows MSI | Check the installer's Authenticode publisher against the running executable when that is signed, then `msiexec /i ... /passive` detached, which starts the new version |
| Linux AppImage | Copy beside `$APPIMAGE`, rename over it, relaunch |
| Linux deb or rpm | Nothing is downloaded: a notice that the package manager updates it |

`beforeUpdate(manifest, { version })` in the agent module is the entitlement hook. `{ refuse: '...' }` stops the
update; `{ warn: '...' }` makes the status carry the warning and `install` require `acknowledge: true`, for a
license whose updates ended before that version.

### Web view traps

- **launchd PATH.** An app opened from Finder gets `/usr/bin:/bin:/usr/sbin:/sbin`; a Linux `.desktop` launch skips
  the shell profile. Tools that work in a terminal are missing. The launcher widens PATH for the agent and its
  children; a tool installed somewhere unusual still needs an absolute path or a setting.
- **A sandboxed app cannot spawn tools.** `ssh`, `docker` or `bun` from inside the App Sandbox fail. Web view apps
  are built unsandboxed with the hardened runtime, which means Developer ID distribution, not the Mac App Store.
- **Craft `shell.spawn` discards output.** See "Processes live in the agent".
- **Craft's single-instance hand-over is Windows and Linux only.** On macOS a second Craft with the same id opens
  a second window, so the launcher never starts one there: the second launch still reaches `secondInstance`, and
  raising the window is the app's to do. LaunchServices already keeps an app opened from Finder or the Dock to one
  instance.
- **An older Craft opens its demo window when handed a flag it does not know.** The build reads the runtime binary
  (`probeCraftFlags`) and the launcher passes `--single-instance`, `--deep-link` and `--app-name` only when present.
  `--single-instance` is on Craft main and in no release up to 0.0.499.
- **URL schemes on macOS** are registered in the Info.plist, but a link opened by LaunchServices arrives as an Apple
  Event, which a Bun executable does not receive. A link reaches the app as an argument on Windows and Linux, and
  on macOS only when the executable is started with it.
- **A compiled agent autoloads nothing.** It is built with `--no-compile-autoload-bunfig` and
  `--no-compile-autoload-dotenv`; read settings from the data directory, not from a `.env` beside the executable.
- **Do not swap a bundle by hand.** The trust check is what stops a stolen update key from installing another
  team's app. An ad hoc signed development build has no team to compare with and refuses to self-update.

## CLI Commands

```bash
buddy new <name> --desktop     # a Stacks app that is also a native Mac app, API inside (macos.agent)
buddy dev:desktop              # run the desktop app: webview, else macos, else the dev server window
buddy build:desktop            # build it; --target and --package for a webview app, --native for macos
buddy desktop:update:keypair   # the Ed25519 keypair that signs update manifests
buddy release:desktop          # sign, notarize, and publish a webview app with signed update manifests
buddy desktop:apple:init       # generate the reusable GitHub Actions caller
buddy desktop:apple:doctor     # validate Apple tooling, identities, profile, and API key
buddy desktop:apple:package    # build, sandbox, sign, and create a Store .pkg
buddy desktop:apple:publish    # validate or upload the package to App Store Connect
buddy desktop:probe            # measure what a Craft window offers interactive/game content
```

A TestFlight release from the developer's Mac needs only the App Store Connect
key (`APP_STORE_CONNECT_API_KEY*`, encrypted in `.env.production`):

```bash
APP_ENV=production buddy desktop:apple:publish --build-number next --testflight 'My Team'
```

`--build-number next` asks App Store Connect for the app's highest build and
uses one more, so every upload is `<version> (n + 1)` with no counter kept
anywhere. `--testflight` waits for processing, gives the build to the named beta
groups (they must already exist; an automatic-distribution internal group gets it
without an explicit add), and sets "What to Test" from `--whats-new` or the
commit subjects since the last tag. Signing identities not named by a variable
are read from the keychain for the team, and a missing
`APPLE_PROVISIONING_PROFILE` is downloaded from App Store Connect.

`desktop:probe` opens a visible Craft window (not `--headless`, which stops
requestAnimationFrame) and measures WebGL2/WebGPU, frame pacing under load,
input and audio latency, the Gamepad API, fullscreen and pointer lock.
`--browser[=Safari]` runs the same page in a browser for comparison, and
`--record` writes the result into `storage/framework/core/desktop/src/probe/results/`,
which `buddy docs:capabilities` publishes in `docs/features/capabilities.md`.
Probes that need a real click or key press are recorded as
`requires-interaction`, never as a number. Stacks ships no game engine,
physics or asset pipeline; this only says what an engine someone else wrote
would get.

## Mac App Store

Run `buddy desktop:apple:init`, then configure the repository variables and
secrets named by the generated workflow. The reusable Stacks workflow builds
Craft from an immutable revision, imports signing material into an ephemeral
keychain, embeds the provisioning profile, applies App Sandbox entitlements,
signs the helper before the parent app, creates a signed installer package, and
uses App Store Connect API-key authentication for validation/upload.

Start with `validate-only: true`. Upload only after the signed artifact passes
local launch and UI QA.

To package on a developer machine without importing distribution keys into the
login keychain, generate keys and certificates with `buddy desktop:apple:csr`
and `buddy desktop:apple:provision --apply`, import the two `.p12` files into a
throwaway keychain file, and point `--keychain <path>` (or `APPLE_KEYCHAIN`) at
it. `codesign` and `productbuild` then look for identities in that file only,
so the search list never changes. The Mac App Distribution identity is named
`3rd Party Mac Developer Application: ...` and the installer one
`3rd Party Mac Developer Installer: ...`.

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
- `APPLE_KEYCHAIN` (local only, optional): sign from this keychain file instead of the search list

Repository secrets:

- `APPLE_APP_CERTIFICATE_BASE64`
- `APPLE_INSTALLER_CERTIFICATE_BASE64`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_PROVISIONING_PROFILE_BASE64`
- `APP_STORE_CONNECT_API_KEY`
- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_API_ISSUER_ID`

## Gotchas
- Configure build identity and browser UI separately; the host build package is
  not a browser-safe native API import. Verify bridge readiness inside the
  actual Craft window before enabling native-only flows.
- Probe results describe the recorded host/runtime version. A successful
  packaging command is not evidence of input/audio/graphics capability parity.
- App Store packaging runs on macOS with Xcode command-line tools.
- The embedded Craft runtime must inherit the parent App Sandbox.
- A Mac App Distribution identity and Mac Installer Distribution identity serve different signing steps.
- The provisioning profile must match the team ID, bundle ID, and requested entitlements.
- App Store upload is not notarization. Outside-Store distribution uses Developer ID signing and notarization instead.
- A Store build number is immutable. Retry upload with the same signed artifact; rebuild with a new number only when the binary changes.
