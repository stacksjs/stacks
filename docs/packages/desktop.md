# Desktop

Stacks builds desktop apps through [Craft](https://github.com/home-lang/craft), a native
runtime that hosts your existing views in a platform window. `buddy dev desktop` runs one
locally; `buddy build desktop` packages it.

## Standalone native applications

A project created with `buddy new --native` uses its own `craft.config.ts` and Pantry's native pipeline. This path is separate from the framework desktop driver matrix below. It supports local model APIs, encrypted release environments, and app-owned signing credentials. New native projects include the canonical Buddy Bot workflow and configuration.

Use `buddy build` for a development bundle, `buddy package` for a development disk image, and `buddy release --bump patch` to qualify and tag a release. The publisher runs the configured checks before versioning.

Enable `native.macos.appStore` in `pantry.json` and provide `app-store.config.ts` or JSON for Apple publishing:

- `buddy desktop:apple:package` qualifies and signs a Store package.
- `buddy desktop:apple:publish --build-number 12` signs, uploads, waits for Apple processing, attaches the build, and prepares the listing.
- `buddy desktop:apple:publish --validate-only` validates a signed package without uploading it.
- `buddy desktop:apple:submit --build-number 12 --submit-for-review` submits the build already uploaded by CI.

Review contact details can stay in encrypted `APP_STORE_REVIEW_CONTACT`, with public review instructions in `reviewNotes`. Keep certificates, profiles, API credentials and private environment keys out of source control. Every operation uses the same `ts-pantry/native` pipeline, including its signed bundle qualification and delivery receipts. Apple processing and review remain external gates; an upload does not establish approval.

## Web view apps on a local agent

`webview` in `config/desktop.ts` declares a desktop app that is the same on macOS, Windows and
Linux: a compiled Bun agent on 127.0.0.1 that serves the project's stx views and its own request
handling, with a Craft web view window as its only caller.

```ts
// config/desktop.ts
import type { DesktopConfig } from '@stacksjs/types'

export default {
  webview: {
    appName: 'Library',
    appId: 'com.example.library',
    window: { width: 1280, height: 800 },
    agent: { entry: 'app/Desktop/Agent.ts', views: 'resources/desktop' },
    updates: { feedUrl: 'https://example.com/api/updates', publicKeys: { main: 'ed25519-public:...' } },
  },
} satisfies DesktopConfig
```

`app/Desktop/Agent.ts` default-exports the app's request handling: a `fetch(request, context)`
that returns a `Response`, or nothing to let the views answer, plus optional `start`,
`secondInstance`, `beforeUpdate` and `stop` hooks. Anything process-shaped (child processes,
files, secrets) belongs there, not in the page: the page talks to the agent over `fetch` and
WebSocket.

Only the app's own window can call the agent. The window opens on a URL with a one-time token,
which is traded for an HttpOnly cookie; every request must carry the cookie and name
`127.0.0.1:<port>` in its Host header. The port is remembered between launches. A second launch
hands its arguments to the first and exits.

| Command | What it does |
|---|---|
| `buddy dev:desktop` | Runs the app from source, with the views rendered live by stx |
| `buddy build:desktop` | Builds this machine's target. `--target linux-x64,win32-x64` or `all` cross-compiles the agents; `--package` makes the installers this operating system can make |
| `buddy desktop:update:keypair` | Prints the Ed25519 keypair that signs update manifests |
| `buddy release:desktop` | Signs and notarizes (macOS), signs (Windows, with a certificate), writes a signed manifest per platform and architecture, and publishes through `@stacksjs/storage` |

Bun cross-compiles the agent for every target from any machine. Installers are made on their own
operating system: the macOS `.app` is signed, notarized and imaged on a Mac; the MSI needs WiX and
`signtool` on Windows; the AppImage, deb and rpm need their Linux tools. For those targets the
build leaves the staged files and a `craft-package.json`, the input to Craft's packaging.

A target other than this machine's needs that platform's Craft runtime. When the config names none
(`webview.runtime` or `CRAFT_BIN_<PLATFORM>_<ARCH>`), the build downloads the one Craft published for
the installed `craft-native` version, verifies it against that release's checksum manifest, and keeps
it in `storage/framework/desktop/runtimes/<target>/`. On Windows `WebView2Loader.dll` comes with it.

A release made in several runs (the Mac from a Mac, then the Linux and Windows installers) adds each
run's platforms to the same `release.json`, so a download page keeps every platform of the version.

An installed app asks `<feedUrl>/<platform>/<arch>` for a newer version. The framework mounts
that route (`/api/updates/{platform}/{arch}`, `Actions/Desktop/UpdateFeedAction`) when
`webview.updates` is configured, and it serves the manifest `release:desktop` published. The app
verifies the manifest's signature and the download's SHA-256 before installing: a bundle swap on
macOS after checking the new bundle is signed by the same team, the MSI on Windows, a replaced
AppImage on Linux, and a notice for deb and rpm installs.

The artifacts themselves are served by the route beside the feed,
`/api/updates/files/{channel}/{target}/{version}/{file}` (`Actions/Desktop/UpdateArtifactAction`),
and a release writes that URL into the manifest, derived from `feedUrl`. It streams from the
updates disk with byte ranges, so a release on the default local disk can be downloaded with no
bucket. Set `webview.updates.artifactBaseUrl` when a bucket or CDN serves the disk itself.
`release:desktop` refuses an artifact URL on a loopback or development host.

The support matrix below is about the older framework desktop driver. Web view apps were built,
launched and exercised on macOS arm64; the Windows and Linux agents are cross-compiled but have
not been run on those systems by the framework's own checks. The `stacks-desktop` skill has the
full contract and the traps.

## Support status

**Every desktop target is experimental.** Craft output is useful for development and for
sharing a build with people who already trust you. It is not yet something to hand to the
public: nothing is code-signed, nothing is notarized, and an unsigned app is one Gatekeeper
or SmartScreen dialog away from looking like malware to the person you sent it to.

The framework enforces that rather than trusting a README.
`assertDesktopReleaseChannel('stable')` throws for every row below, so a release pipeline
that asks for a stable desktop artifact fails instead of shipping one.

<!-- desktop-support-matrix:begin -->

<!-- Generated by `buddy docs:desktop-matrix` from `@stacksjs/desktop-build`'s
     `desktopSupportMatrix`. Edit that, not this. -->

| Target | Status | Tested on | Package | Signing | Notarization | Install + launch | Blocked by |
|---|---|---|---|---|---|---|---|
| macOS arm64 | **experimental** | macOS 27.0 (local run, Craft v0.0.107 published archive), macOS 15 runner (CI, Craft v0.0.48 from source) | DMG + PKG | pending | pending | [evidence](https://github.com/stacksjs/stacks/blob/main/storage/framework/core/desktop/evidence/lifecycle-darwin-arm64.json) | [stacksjs/stacks#2062](https://github.com/stacksjs/stacks/issues/2062) |
| macOS x64 | **experimental** | macOS 15 Intel runner | DMG + PKG | pending | pending | [run 29890804159](https://github.com/stacksjs/stacks/actions/runs/29890804159) | [stacksjs/stacks#2062](https://github.com/stacksjs/stacks/issues/2062) |
| Linux x64 | **experimental** | Ubuntu 24.04 runner | DEB | pending | not-applicable | [run 29890804159](https://github.com/stacksjs/stacks/actions/runs/29890804159) | [stacksjs/stacks#2062](https://github.com/stacksjs/stacks/issues/2062) |
| Windows x64 | **experimental** | Windows Server 2025 runner | MSI + ZIP | pending | not-applicable | [run 29890804159](https://github.com/stacksjs/stacks/actions/runs/29890804159) | [stacksjs/stacks#2062](https://github.com/stacksjs/stacks/issues/2062) |

### Known limitations

- **macOS arm64** - The Stacks-built app bundle, DMG and PKG are unsigned while platform identities remain unprovisioned. The Craft runtime inside them is Developer ID-signed by Craft's own release workflow, which does not make the app signed.
- **macOS arm64** - Lifecycle evidence was re-run on 2026-10-03 against the published Craft v0.0.107 archive (craft-darwin-arm64.zip, sha256 98e1a7ae478a8900256add2884d05cc07aea2f3de7d550590d9458abd4fe7725) with `storage/framework/core/desktop/evidence/lifecycle.ts`: PKG and DMG install, a real Craft window launched from the installed bundle, update, a refused truncated update, rollback and uninstall all passed.
- **macOS arm64** - That run was local on macOS 27.0, not CI, and installed into the user domain (~/Applications) rather than /Applications. Gatekeeper was not exercised, since nothing carried a quarantine flag. The last CI lifecycle run for this target (https://github.com/stacksjs/stacks/actions/runs/29890804159, macOS 15 runner) used Craft v0.0.48 built from source.
- **macOS x64** - Lifecycle fixtures are unsigned while platform identities remain unprovisioned.
- **macOS x64** - Lifecycle evidence was produced against Craft v0.0.48 built from source (bf75807). Craft now publishes a prebuilt craft-darwin-x64.zip with every release, and no Stacks lifecycle run has re-verified a prebuilt release yet.
- **Linux x64** - The lifecycle fixture is unsigned and no package repository support policy is published.
- **Linux x64** - Lifecycle evidence was produced against Craft v0.0.48 built from source (bf75807). Craft now publishes a prebuilt craft-linux-x64.zip with every release, and no Stacks lifecycle run has re-verified a prebuilt release yet.
- **Windows x64** - The lifecycle fixture is not Authenticode-signed.
- **Windows x64** - Lifecycle evidence was produced against Craft v0.0.48 built from source (bf75807). Craft now publishes a prebuilt craft-windows-x64.zip with every release, and no Stacks lifecycle run has re-verified a prebuilt release yet.

<!-- desktop-support-matrix:end -->

## What "experimental" is waiting on

One blocker, and it is not a code change here:

- **Platform identities.** Apple Developer ID and notarization credentials, and an
  Authenticode certificate for Windows. Tracked in
  [stacksjs/stacks#2062](https://github.com/stacksjs/stacks/issues/2062) - this is a
  procurement step, not an engineering one.

Craft releases are no longer a blocker. Its release workflow was restored
([home-lang/craft#11](https://github.com/home-lang/craft/issues/11), closed), and every
release now publishes prebuilt `craft-darwin-arm64`, `craft-darwin-x64`, `craft-linux-x64`
and `craft-windows-x64` archives. The macOS arm64 lifecycle has been re-run against the
published v0.0.107 archive, locally and unsigned, with
`storage/framework/core/desktop/evidence/lifecycle.ts`. The other three targets' evidence
still comes from Craft v0.0.48 built from source, and needs a runner of that platform to
move to a published release.

Once the identities exist and a signed artifact has passed install, update and rollback,
that row's `signing` and `notarization` move to `enforced`, its `status` moves to `stable`,
and the guard stops refusing.

## Reading the matrix

- **Tested on** is the CI runner image, or for a local run the OS version, the
  install-and-launch fixture ran against, not a claim about every version of that OS. A
  macOS 15 runner says nothing about macOS 13.
- **Install + launch** links the run that packaged the artifact, installed it and launched
  it. A row without one has no evidence and cannot be released on any channel.
- **Signing** and **Notarization** are `pending` until the credentials exist. `not-applicable`
  means the platform has no such step, not that it was skipped.

The table is generated from `desktopSupportMatrix` in `@stacksjs/desktop-build` by
`buddy docs:desktop-matrix`, and CI fails when the two disagree. Change the source, not
this page.

## Permissions, storage, and protocol handlers

What a Stacks desktop app is allowed to do, where it keeps things, and which URLs reach
it. Every statement here is about what the framework itself produces. An application can
widen most of it, and the notes say how.

### Permissions

There are two packaging paths, and they grant different things.

| | `buddy build:dmg` (direct download) | `buddy desktop:apple:package` (Mac App Store) |
|---|---|---|
| App Sandbox | Off. When `DESKTOP_SIGNING_IDENTITY` is set, every executable is signed with `app/Desktop/Entitlements.plist` if it exists and with no entitlements if not. | On. The bundle gets `com.apple.security.app-sandbox` and `com.apple.security.network.client`, nothing else. |
| Craft runtime | When signing, re-signed with the launcher's entitlements, which drops the sandbox entitlement a published Craft binary arrives with. Unsigned, it keeps whatever signature it was built with. | Signed first, with only `app-sandbox` and `com.apple.security.inherit`, so it runs inside the parent's sandbox and cannot hold grants of its own. |
| Extra capabilities | Whatever `app/Desktop/Entitlements.plist` declares. | Not configurable yet. User-selected files, camera, microphone and every other sandbox capability are not granted. |
| Permission prompt text | `NS*UsageDescription` keys from `app/Desktop/Info.plist.json`. | Not read. The Store `Info.plist` carries no usage descriptions. |
| Network transport | The framework launcher allows arbitrary loads, because its window opens a remote URL. An app-owned launcher gets a loopback-only exception instead. `Info.plist.json` can replace either. | Default App Transport Security, which requires HTTPS. Outbound only: listening on a port, as an app-owned launcher serving on loopback does, needs `com.apple.security.network.server`, which is not granted. |

In both, the framework launcher starts Craft with `--no-devtools`, so the web inspector is
not available in a packaged app. An app-owned launcher decides that for itself.

**The page in the window is the trust boundary.** Craft exposes a `window.craft` bridge
to it, which the framework wraps in `useCraft()`, `useWindowControls()` and
`useAppControls()`: window controls (minimize, close, show, hide, toggle), app controls
(quit, notifications, app info), sidebar selection, and the system tray. Stacks adds no
origin check of its own, and whether Craft limits the bridge by origin is Craft's contract,
so treat any page the window can navigate to as able to call those.

### Storage

- **The bundle is not a secret store.** `desktop.json` (the URL, title, window size and
  flags) sits in `Contents/Resources` in plain text, and the launcher and runtime are
  readable by anyone with the app. Ship no credentials in either.
- **The launcher does not load `.env` or `bunfig.toml`.** It is compiled with
  `--no-compile-autoload-dotenv` and `--no-compile-autoload-bunfig`, so it never picks up
  configuration from whatever directory it was started in.
- **Web storage belongs to Craft's WebView**, not to Stacks. Cookies, `localStorage` and
  IndexedDB live wherever the WebView keeps them. Under the App Sandbox, anything the app
  writes lands in its own container.
- **No secret-storage API.** Stacks does not wrap the Keychain, Credential Manager or
  Secret Service. An app that holds tokens needs its own.
- **Updates are staged, not installed.** `stageDesktopUpdate` refuses a manifest without
  a valid Ed25519 signature from a trusted key, refuses a build for another platform or
  architecture, refuses plain HTTP outside loopback, checks the exact size and SHA-256,
  then writes the file with mode `0700` through a temporary name and an atomic rename. A
  failed download, check or write leaves the update staged before it untouched and no
  partial file behind. Applying it is the caller's job.

### Protocol handlers

- **Stacks registers no URL scheme.** Neither `Info.plist` it writes declares
  `CFBundleURLTypes`, and there is no API for one.
- **A scheme declared through `Info.plist.json` is not a supported path.** `build:dmg`
  would copy the key in, but the bundle's executable is the launcher, and the framework
  launcher opens the URL from `desktop.json` without forwarding an activation URL to Craft. Craft has
  added deep-link handling in its own packaging, and Stacks has not adopted it.
- **Invite links are web links.** `createInviteLink` builds an `https://` URL to
  `/invite`, which opens in a browser, not in the app.

## Querying it from code

```ts
import { assertDesktopReleaseChannel, desktopSupport } from '@stacksjs/desktop-build'

// What this machine's target supports, or undefined for one that is not in the matrix.
const row = desktopSupport()

// Throws unless the running target may ship on that channel.
assertDesktopReleaseChannel('experimental')
```

## Related

- `buddy desktop:probe` - measures whether a Craft window can host interactive or game
  content (WebGL2/WebGPU, frame pacing, input and audio latency, gamepad, fullscreen,
  pointer lock); the recorded results are in the
  [capability matrix](../features/capabilities.md#desktop-interactive-content)
  ([#877](https://github.com/stacksjs/stacks/issues/877)).
- `buddy desktop:apple:*` - Mac App Store packaging and delivery
  ([#2199](https://github.com/stacksjs/stacks/issues/2199)). `desktop:apple:package
  --universal` ships one arm64 + x86_64 app: Bun cross-compiles both launcher slices, the
  two Craft slices come from `CRAFT_BIN_ARM64` and `CRAFT_BIN_X64`, and `lipo` merges each
  pair after checking what every input actually contains.
- The `stacks-mobile` skill covers the iOS and Android side of the same Craft bridge
