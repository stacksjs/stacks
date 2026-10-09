---
name: stacks-mobile
description: Use when building native iOS or Android applications from a Stacks and STX codebase with Craft, including mobile configuration, native capabilities, safe areas, haptics, sharing, and mobile build output.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, Xcode for iOS project generation
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Mobile

Stacks mobile applications reuse the same STX views, components, routes, and
API as the web application. Craft owns the platform project and native bridge;
Stacks owns application configuration and build orchestration.

## Key paths

- App configuration: `config/mobile.ts`
- Mobile runtime: `storage/framework/core/mobile/src/`
- Platform build actions: `storage/framework/core/actions/src/build/ios.ts` and `build/android.ts`
- Reusable STX components: `storage/framework/defaults/resources/components/Native*.stx`
- Generated iOS project: `storage/framework/mobile/ios/` (ignored build output)

## Build

```bash
buddy build:mobile
buddy build:ios
buddy build:android
```

`buddy build:mobile` builds both native projects in sequence. Use the
platform-specific commands when iterating on only one native target. The same
targets are available through `buddy build mobile`, `buddy build ios`, and
`buddy build android`.

The build validates `config/mobile.ts`, initializes a Craft iOS project,
selects either a remote application URL or bundled web assets, generates the
Xcode project with xcodegen, and records source, capability, and Craft builder
revision provenance in `stacks-mobile.json`.

For local Craft development, point Stacks at Craft's builder source:

```bash
CRAFT_IOS_SRC=/absolute/path/to/craft/packages/ios/src/index.ts buddy build:ios
CRAFT_ANDROID_SRC=/absolute/path/to/craft/packages/android/src/index.ts buddy build:android
```

`STACKS_IOS_SKIP_XCODEGEN=1` and `STACKS_ANDROID_SKIP_GRADLE=1` are only for
source-level CI and tests. Shippable projects must be generated and compiled
with Xcode or Gradle respectively.

## Configuration

```ts
import type { MobileConfig } from '@stacksjs/types'

export default {
  ios: {
    appName: 'My App',
    bundleId: 'com.example.app',
    url: 'https://example.com',
    fallbackWebAssets: 'dist',
    deploymentTarget: '16.0',
    orientations: ['portrait'],
    urlSchemes: ['myapp'],
    capabilities: {
      haptics: true,
      share: true,
      geolocation: true,
      secureStorage: true,
    },
  },
  android: {
    appName: 'My App',
    packageName: 'com.example.app',
    url: 'https://example.com',
    fallbackWebAssets: 'dist',
    capabilities: {
      haptics: true,
      share: true,
      geolocation: true,
      secureStorage: true,
    },
  },
} satisfies MobileConfig
```

Choose exactly one primary content source:

- `url`: load the deployed Stacks application and keep server-rendered routes.
- `webAssets`: bundle a static distribution containing `index.html` and every
  referenced asset.
- `fallbackWebAssets`: with `url`, bundle a static distribution that Craft
  loads when the remote application is unreachable on cold start.

Only enable capabilities the product uses. Craft turns enabled capabilities
into native bridge availability and required iOS privacy descriptions.

The shell's behaviour around the page defaults to a native app's; set only
what should differ: `swipeBack` (`'router'`, the stx router's interactive
swipe, or `'webview'` for WebKit's history swipe), `keyboardAccessory` (off),
`allowsLinkPreview` (off), `disableZoom` (on), `splashMaxSeconds` (3),
`requestTimeoutSeconds` (10), `backgroundRefresh: { enabled, identifier?,
minimumIntervalMinutes? }` and `associatedDomains` (universal links). Leave
`swipeNavigation` unset: WebKit's swipe alongside the router's fights it, and
`buddy build:ios` warns. The Liquid Glass chrome needs iOS 26 at run time;
the default `deploymentTarget` stays, older systems drawing classic bars.

## Device search index

`spotlight` says what of the application's own content a device may index, so
somebody searching their home screen finds a record rather than only finding
the app:

```ts
export default {
  ios: { /* ... */ },
  spotlight: {
    kinds: {
      trail: { slots: 24, route: '/trail/:id', noun: 'Trail' },
      club: { slots: 8, route: '/club/:id', noun: 'Club' },
    },
    // Anything the app donates outside the registry: a Siri phrase, an App Intent.
    activityTypes: ['favorites', 'trails-near-me'],
  },
} satisfies MobileConfig
```

`slots` is a budget, not a guess. iOS indexes donated `NSUserActivity` objects
and hands a tapped one back only for an activity type the build declares in
`Info.plist`, a list fixed at build time — so a type per record id cannot be
declared at all. Each kind gets that many slots, each slot holds whichever
record is currently in it, and the oldest donation makes room for the next.
`buddy build:ios` writes the declarations; an entry the build did not declare
still appears in Spotlight and merely opens the app wherever it was last, which
looks like the feature working until somebody taps a result.

Drive it with one index per application:

```ts
import mobileConfig from '../config/mobile'
import { createSpotlightIndex, onSpotlightTap } from '@stacksjs/mobile'

export const spotlight = createSpotlightIndex({ kinds: mobileConfig.spotlight.kinds })

await spotlight.index('trail', { id: trail.id, name: trail.name }) // one record
await spotlight.sync('club', myClubs) // a list that is theirs, most important first
await spotlight.remove('club', club.id) // left, unsaved, withdrawn from, deleted
await spotlight.clear() // sign-out: none of it is this person's
onSpotlightTap(spotlight, route => location.assign(route))
```

Every call is a no-op that reports as much off a native host, on a build whose
host predates the bridge, and where the index is turned off (`enabled: false`),
so a page can donate unconditionally. `spotlight.routeFor(action)` answers a tap
synchronously for an app that already routes Craft's shortcut events itself.

Index what is the person's — saved, joined, entered — rather than what they
looked at, wherever the page re-renders on that change: a page that donates on
every render would put a record straight back the moment they left it. Donating
the same record twice is free, so an effect over the record is the natural call
site.

## Runtime API

```ts
import { haptics, keepAwake, location, pushNotifications, share, withNativeFeedback } from '@stacksjs/mobile'

await haptics.selection()
const position = await location.getCurrentPosition({ enableHighAccuracy: true })
await location.startRecording({ enableHighAccuracy: true })
await keepAwake.enable()
const pushToken = await pushNotifications.register()
await share.share({ title: 'Route', url: 'https://example.com/routes/1' })
await withNativeFeedback(() => saveActivity())
```

The runtime is browser-safe. Craft-backed operations use the native bridge;
supported web APIs provide fallback behavior outside a native host. Inside a
native host whose bridge is still loading (an older shell installs it after
the page loads), a call waits for it briefly instead of taking the web path.
Nothing throws for being unsupported: it resolves `null` or `false`.

Beyond the services above, each with a web fallback:

```ts
import { browser, clipboard, confirmAction, contextMenu, db, dialog, files, haptics, orientation, shortcuts, storeKit, symbols, useActionSheet, widgets } from '@stacksjs/mobile'

await dialog.alert({ title: 'Saved' }) // UIAlertController, or an HTML alert
if (await confirmAction({ title: 'Delete this workout?', confirmLabel: 'Delete', destructive: true })) remove()
const id = await useActionSheet()({ actions: [{ id: 'skip', title: 'Skip' }] }) // null when cancelled
await contextMenu.show({ items, anchor }) // UIMenu, or an HTML menu over the blurred page
await browser.open(url, { mode: 'auth', callbackScheme: 'myapp' }) // ASWebAuthenticationSession
await symbols.image('heart.fill') // an SF Symbol as a PNG data URL, cached
await haptics.prepare('impact') // wake the Taptic Engine before a likely tap
```

Also `statusBar`, `chrome` (under-page colour, keyboard accessory),
`refresh` (the native UIRefreshControl), `background.complete`, `clipboard`,
`db` (the app's SQLite), `files` (PDF, screenshot, QR scan, pick, save,
download), `shortcuts` (home screen quick actions), `widgets`,
`orientation`, `auth.signInWithApple` and `storeKit`. The phone's events:
`onAppearance`, `onResume`, `onMemoryWarning`, and `onSilentPush` /
`onBackgroundRefresh`, which tell iOS the work is done when the handler
settles.

For a run or ride, `createRouteRecorder({ location, onUpdate })` starts, pauses,
resumes and stops the native recording, re-attaches to one that outlived the
app (`attach()`), and reports live distance and pace from `routeStats(fixes)`,
which ignores GPS drift, inaccurate fixes and the ground crossed during a pause.

## STX components

- `<NativeAppShell>` applies iOS safe-area insets and reserves tab-bar space.
  In the phone app it sets the system font at the Dynamic Type size (the
  components size in `em` off `--native-font-size`), drops the tap flash and
  double-tap delay, gives `data-native-pressable` elements UIKit's pressed
  state (and wakes the haptics as a finger lands), and keeps the under-page
  colour, status bar, keyboard bar and Reduce Motion
  (`data-native-reduce-motion` on the root) in step with the page.
- `<NativeTabBar>` provides the accessible navigation shell and selection haptics.
- `<NativeTabItem>` provides each route, active state, label, and Iconify icon.
- `<NativeShareButton>` opens the native share sheet and reports feedback.
- `<NativeNetworkBanner>` reflects native connectivity changes and announces offline state accessibly.
- `<NativePermissionButton>` wraps permission status, requests, haptics, and the native Settings escape hatch.
- `<NativeHealthButton>` requests the minimal Apple Health or Android Health Connect grants.
- `<NativeNavBar>` is the iOS navigation bar: a large title that collapses into
  the bar with the scroll, a frame at a time (and stretches when pulled past
  the top), a `chevron.backward` back button (`back="/parent"`) that goes back
  through history when the app pushed the screen, and `leading` / `actions`
  slots. Pass `:large="false"` on a pushed screen; `title` is reactive.
- `<NativePullToRefresh @refresh="reload">` refreshes the page when pulled from
  its top: the phone's own UIRefreshControl in the shell, the 12-spoke
  indicator with the content held down elsewhere. The event carries `done()`:
  call it when the new data is in. `scrollHost=".list"` for a screen that
  scrolls in a container.
- `<NativeSegmentedControl :options="[...]" v-model:value="range">` switches
  between views of one screen, with selection haptics, thumb scrubbing and
  arrow keys.
- `<NativeSheet v-model:open="editing" title="…">` raises a bottom sheet for a
  task that belongs to the screen: dragged down from its grabber or header to
  dismiss, the page behind inert. `detents="medium large"` makes it full
  height with detents, the page pressed into a card at large.
- `<NativeContextMenu :items="[...]" @select="…">` opens a menu on a
  half-second press: UIMenu in the shell, an HTML menu elsewhere.
- `<NativeActionSheet v-model:open="choosing" :actions="[...]" @select="…">`
  asks for a choice from the bottom; `confirmAction()` and `useActionSheet()`
  do it from code.
- `<NativeSymbol name="heart.fill" icon="i-lucide-heart">` draws an SF Symbol
  in the text colour, with an Iconify stand-in where there are none.
- `<NativeProgressRing :value="percent" :size="176">` fills a ring as something
  completes (sets done, a countdown running out), with its content in the
  slot. Colours follow `--native-ring` and `--native-ring-track`.
- A screen that is a task of its own (a workout player, a composer) marks an
  element `data-native-hide-tab-bar`, and the tab bar steps away while it is
  shown, its reserved space with it.
- `<Video :src="current.url">` is the framework's player (ts-video-player):
  YouTube, Vimeo, HLS, DASH or a file. `src` is reactive, so one player in a
  sheet can show whichever video is chosen; clearing it pauses the player.
  Craft lets an https iframe load inside the app, so embeds play inline.

`<NativeTabItem match="/m/workout">` keeps a tab lit on the detail screens
opened from it. A tab bar is a `<nav>`, where a link is otherwise current only
on its own page. Tab links are the stx router's tabs (`data-stx-nav="tab"`):
each keeps its own screens and history, and choosing the current one again
scrolls it to the top, then pops it to its root (`stx:tabreselect`).

Use Iconify classes for tab icons. Keep native operations inside reusable
components or TypeScript composables, never through `window.*` in an STX
script.

## Appearance and navigation

`ios.appearance: 'system'` follows the phone's Light/Dark setting (and the
page's `prefers-color-scheme` with it), with a status bar that reads on either;
`'light'` and `'dark'` pin one. `ios.backgroundColorDark` colours the launch
screen and webview in Dark Mode. An edge swipe goes back through the stx
router's own interactive swipe; WebKit's (`ios.swipeBack: 'webview'`) is only
for an app whose pages are not on the router.

Decide native-only chrome with `await whenNativeMobile()`, not
`isNativeMobile()` at setup: Craft installs its bridge after the page starts.

## Health and watch surfaces

Enable `healthKit` on iOS or `healthConnect` on Android, then use the shared
`health` service to request only the record types the product needs. On iOS,
`health.getWorkouts()` lists Apple Health workouts (keyed on HealthKit's UUID)
and `health.getDailyStatistics(type)` returns one value per day for steps,
energy, distance, heart rate, resting heart rate, HRV, weight and sleep. Completed
recordings can be written back with `health.saveWorkout(...)`; treat permission
revocation as a normal runtime state and never block saving the application's
own activity when a health write fails.

Enable `watchApp` to generate and embed the SwiftUI watchOS companion. The
shared `watchConnectivity` service exchanges commands and the latest recording
context without exposing `WCSession` to STX templates. Set
`ios.watchDeploymentTarget` when the default watchOS 9.0 target is not suitable.

## Validation

Before finishing mobile work:

```bash
buddy lint
bun run typecheck:app
buddy test
buddy build:ios
buddy build:android
```

On a Mac with full Xcode selected, compile the generated project for an iOS
Simulator (including embedded extensions and watchOS dependencies) and a
physical-device archive. Compile the Android project with Gradle when Android is
configured. Verify permission prompts, safe-area
layout, deep links, offline/error states, background transitions, and native
feedback on device.

A device search index needs its own device check, because nothing about it is
observable from the generated project: search a record's name from the home
screen, confirm the entry appears and opens that record rather than the last
screen, then make it stop being the person's (leave, unsave, withdraw, sign
out) and confirm it stops being findable.
