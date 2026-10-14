---
title: "Mobile Apps"
description: "Ship the same STX application as a native iOS and Android app with Craft: the Native components, the @stacksjs/mobile runtime, and the iOS build options that make it feel native."
---
# Mobile Apps

## TestFlight versioning

Keep an unreleased app on its intended marketing version, such as `1.0.0`.
Ship another test build with `buddy release:ios` or the explicit
`buddy release:ios --bump build`. Both retain the marketing version and
allocate the next build number with Bumpx, accounting for release tags and
previous Xcode Cloud runs, including failures and builds still in flight.

Each release also leaves a GitHub release for its tag, with the TestFlight
build number and the changes since the previous tag; `buddy release:github
<tag>` creates one a release could not. The iOS build runs Pantry's xcodegen
(`iosDependencies` in `config/deps.ts`, installed by `buddy setup:ios`); Xcode
itself comes from the App Store, not Pantry.

Use `--bump patch`, `minor`, `major`, or an explicit stable version only when
deliberately changing the marketing version. Semantic prerelease identifiers
and build metadata belong to package versions, not the iOS marketing field.

A Stacks application becomes an iOS and Android app without a second
codebase. [Craft](https://github.com/stacksjs/craft) wraps the same STX views,
routes and API in a native shell, and Stacks supplies two things on top of it:

- **The Native components** (`<NativeAppShell>`, `<NativeNavBar>`,
  `<NativeSheet>` and the rest), which behave like UIKit's controls: the same
  type, motion, gestures and haptics.
- **`@stacksjs/mobile`**, a typed runtime for everything the shell can do
  natively, from haptics and dialogs to StoreKit, each with a web fallback so
  a page calls it unconditionally.

```bash
buddy build:ios      # generate and compile the Xcode project
buddy build:android  # generate the Gradle project
buddy build:mobile   # both
```

## Configuration

### Zero Swift application source

Write screens and application logic in STX and TypeScript. Craft publishes its
reusable Swift shells inside `craft-native`; Stacks generates sources in
`storage/framework/mobile/ios` and ignores them as build output, including watch
and widget extensions. Configure capabilities, chrome, permissions, storage
sharing and deployment targets here instead of editing generated Swift.

For Xcode Cloud, commit project metadata, `craft.config.json`, assets, compiled
screen bundles and the generated executable `ci_scripts/ci_post_clone.sh`.
The hook follows [Apple’s custom build script contract](https://developer.apple.com/documentation/xcode/writing-custom-build-scripts).
After a clone, it installs frozen dependencies and restores Swift from the
installed package. `ios.shell.bunVersion` pins its Bun bootstrap when Bun is not
available; otherwise it defaults to the version that generated the project. The
restore step uses an isolated Bun config and does not boot the application.
Rebuild project metadata when native configuration or Craft changes. Existing
applications should untrack previously committed Swift with `git rm --cached`
while keeping generated files locally for Xcode.

If your app ignores the whole mobile build directory, add these rules after
that ignore before committing the Xcode Cloud metadata. The generated iOS
`.gitignore` continues to exclude Swift:

```gitignore
!/storage/framework/mobile/
/storage/framework/mobile/*
!/storage/framework/mobile/ios/
/storage/framework/mobile/ios/build/
/storage/framework/mobile/ios/**/xcuserdata/
```

The Bun-only testing tools share the same configuration:

```ts
import { prepareIosSimulatorDriver, serializeSimulatorSteps } from '@stacksjs/mobile/testing'
import mobile from './config/mobile'

const { output, projectName } = prepareIosSimulatorDriver(mobile.ios)
const script = serializeSimulatorSteps([
  { command: 'launch' },
  { command: 'expect', text: 'Today', seconds: 10 },
])
```

`ios.simulator` customizes the test host's output (default
`storage/framework/mobile/ios-driver`), project name, bundle prefix, iOS target
(17+), and control URL. Tab labels and the installed app id come from `ios.tabs`
and `ios.bundleId`. Use xcodegen and xcodebuild to generate and run the host against
an installed app, serving the journey at `/script` and collecting `/note` and
`/save` evidence. `TEST_RUNNER_CRAFT_TEST_CONTROL` overrides the control URL per
run. Existing line-based journeys also work. Failed assertions fail XCTest.

For captured native-screen updates, `createNativeMutationValidator()` compiles
and runs the actual Swift mutation host on macOS with swiftc. Call
`validate(messages)` and `dispose()` after testing. `restoreIosShell(output)`
restores a committed Xcode project's sources in other CI environments.
These are build/test APIs; browser code imports the ordinary mobile entrypoint.

`config/mobile.ts` describes the app. Only the identity and one content
source are required:

```ts
import type { MobileConfig } from '@stacksjs/types'

export default {
  ios: {
    appName: 'My App',
    bundleId: 'com.example.app',
    url: 'https://example.com/m',
    fallbackWebAssets: 'dist',
    appearance: 'system',
    backgroundColor: '#f8fafc',
    backgroundColorDark: '#020617',
    capabilities: { haptics: true, share: true, deepLinks: true },
  },
} satisfies MobileConfig
```

### Native screens on Android

`android.renderer: 'native'` draws the same `.stx` screens as
`ios.renderer: 'native'` with Android views and no web view. List the same `nativeScreens`,
`tabs` and `nativeApp` (share them as constants in `config/mobile.ts`), and
`buddy build:android` compiles the screens into the bundle Craft runs, writes
the app's Lucide icons as vectors (Android has no SF Symbols), and stops when
the resolved Craft predates the Android shell (`CRAFT_ANDROID_FLOORS` in
`actions/src/build/android-config.ts`, the sibling of iOS's capability floors).

```ts
const nativeScreens = { '/m': 'Today', '/m/workout/:id': 'Workout' }
const tabs = [{ id: '/m', title: 'Today', symbol: 'sun.max' }]

export default {
  ios: { renderer: 'native', nativeScreens, tabs, nativeApp: 'resources/native/app.ts', /* ... */ },
  android: {
    renderer: 'native',
    nativeScreens,
    tabs,
    nativeApp: 'resources/native/app.ts',
    url: 'https://example.com/m',
    backgroundRefresh: { enabled: true, minimumIntervalMinutes: 120 },
    healthConnect: { read: ['workouts', 'sleep', 'heartRate'], write: ['workouts'], background: true },
    privacyPolicyUrl: 'https://example.com/privacy',
    capabilities: { healthConnect: true, pushNotifications: true, haptics: true },
  },
} satisfies MobileConfig
```

- `backgroundRefresh` wakes the app script through WorkManager (15 minutes at
  the least) with `craftBackgroundRefresh`, as iOS's background refresh does.
- `healthConnect` lists the Health Connect types the manifest declares: Google
  Play reviews each permission, so list only what the app reads and writes.
  `background` adds the background-read permission (Android 15), `history`
  reads past the 30 days before the first grant.
- `buddy build:android --bundle` builds a signed Android App Bundle for Google
  Play with the upload key in `CRAFT_ANDROID_KEYSTORE`,
  `CRAFT_ANDROID_KEYSTORE_PASSWORD`, `CRAFT_ANDROID_KEY_ALIAS` and
  `CRAFT_ANDROID_KEY_PASSWORD`.

### Feeling native

These options shape how the shell behaves around the page. Every one has a
default that matches a native app, so set only what you want different.

| Option | Default | What it does |
| --- | --- | --- |
| `swipeBack` | `'router'` | Who answers an edge swipe back. The stx router drags the previous screen in under the finger; `'webview'` hands the gesture to WebKit's history swipe instead, for an app not on the router. |
| `swipeNavigation` | off | WebKit's own history swipe. Leave it unset: with the router's swipe as well, the two fight over one gesture, and the build warns. |
| `keyboardAccessory` | off | The previous/next/Done bar above the keyboard. |
| `allowsLinkPreview` | off | WebKit's preview on a long press of a link. |
| `disableZoom` | on | No pinch or double-tap zoom. |
| `splashMaxSeconds` | 3 | The longest the launch screen waits for the first page to paint. |
| `requestTimeoutSeconds` | 10 | How long the first load may take before the bundled fallback. |
| `backgroundRefresh` | off | `{ enabled, identifier?, minimumIntervalMinutes? }`: let iOS wake the app to refresh (see `onBackgroundRefresh`). |
| `associatedDomains` | none | Universal links and shared credentials, e.g. `applinks:example.com`. |

`deploymentTarget` keeps Craft's default. The Liquid Glass tab bar and chrome
need iOS 26 at run time; an older system draws the classic bars, so raising
the target is a product decision rather than a requirement.

## The app shell

Wrap the mobile layout in `<NativeAppShell>`:

```html
<NativeAppShell tabBar deepLinks>
  <NativeNetworkBanner />
  <slot />
  <template #tab-bar>
    <NativeTabBar label="My App">
      <NativeTabItem label="Today" href="/m" icon="i-lucide-sun" symbol="sun.max" />
      <NativeTabItem label="Library" href="/m/library" icon="i-lucide-library" symbol="books.vertical" />
    </NativeTabBar>
  </template>
</NativeAppShell>
```

Inside the phone app the shell:

- sets the system font at the body size the phone's **Dynamic Type** setting
  chooses. The Native components size their text in `em` off
  `--native-font-size` (17px at the default size), so they grow and shrink
  with it. Keep a brand face with `--native-font-family`.
- removes the grey tap flash and the double-tap delay from links and buttons.
- gives anything marked `data-native-pressable` the pressed state UIKit's
  buttons have: dimmed and pressed in at once, eased back on release, and the
  Taptic Engine woken as the finger lands so a haptic plays without delay.
  `data-native-pressable="opacity"` only dims.
- keeps the native chrome in step: the colour past the page's edges follows
  its background, the status bar its colour scheme (including the `.dark`
  class), the keyboard's accessory bar stays off, and the phone's Reduce
  Motion and Reduce Transparency settings land on the root element as
  `data-native-reduce-motion` and `data-native-reduce-transparency`.

### Tabs

`<NativeTabItem>` links are the stx router's tabs (`data-stx-nav="tab"`):
each tab keeps its own screens and history, switching adds no back entry,
choosing the current tab again scrolls it to the top and a second time pops
it to its root. A screen can react to that with `stx:tabreselect`. Inside the
iOS shell the bar is drawn natively and plays its own haptic.

## Components

### `<NativeNavBar>`

```html
<NativeNavBar title="Workouts" back="/m" />
```

A large title that collapses into the bar as the page scrolls, linked to the
scroll a frame at a time: the bar's material fades in and the small title
rises into it as the large one passes under, and pulling past the top
stretches the large title slightly. The back button is SF Symbols'
`chevron.backward` and names the screen it returns to. Pass `:large="false"`
on a pushed screen.

### `<NativeSheet>`

```html
<NativeSheet v-model:open="editing" title="Edit set" detents="medium large">
  ...
</NativeSheet>
```

Drag it by its grabber or header: a flick (faster than half a pixel a
millisecond) or a drag past half way dismisses it, anything shorter springs
back. With `detents` it is full height and rests at `medium` (half the
screen) or `large`, opening at the first one named; at `large` the page
behind presses back into a card, as an iOS page sheet does (not under Reduce
Motion). While it is up the page behind is inert and still, focus stays
inside, and Escape closes it. Without `detents` it is as tall as its content.

### `<NativePullToRefresh>`

```html
<NativePullToRefresh @refresh="({ done }) => reload().finally(done)">
  ...
</NativePullToRefresh>
```

In the iOS shell this is the phone's own UIRefreshControl. Elsewhere the web
gesture draws the same thing: the 12-spoke activity indicator revealed spoke
by spoke as the page is pulled, a haptic at the threshold, the content held
down under the spinner while refreshing and eased back up when `done()` is
called. `scrollHost=".selector"` refreshes a screen that scrolls inside a
container rather than the page (always with the web gesture).

### `<NativeContextMenu>`

```html
<NativeContextMenu
  :items="[
    { id: 'share', title: 'Share', symbol: 'square.and.arrow.up', icon: 'i-lucide-share' },
    { id: 'delete', title: 'Delete', symbol: 'trash', destructive: true },
  ]"
  @select="onMenu"
>
  <WorkoutRow :workout="workout" />
</NativeContextMenu>
```

A half-second press presses the content in, plays a haptic and opens the
phone's own menu beside it; in a browser a menu drawn over the blurred page.
`symbol` is for the native menu, `icon` for the web one. The keyboard's menu
key and Shift+F10 open it too.

### `<NativeActionSheet>`

```html
<NativeActionSheet
  v-model:open="choosing"
  title="This workout"
  :actions="[{ id: 'skip', title: 'Skip today' }, { id: 'delete', title: 'Delete', style: 'destructive' }]"
  @select="onChoice"
/>
```

UIAlertController's action sheet in the phone app, the same sheet drawn in
HTML elsewhere, with Cancel set apart. From code, without a component:

```ts
import { confirmAction, useActionSheet } from '@stacksjs/mobile'

if (await confirmAction({ title: 'Delete this workout?', confirmLabel: 'Delete', destructive: true }))
  await remove(workout)

const choose = useActionSheet()
const id = await choose({ actions: [{ id: 'photo', title: 'Take Photo' }, { id: 'library', title: 'Choose from Library' }] })
```

### `<NativeSymbol>`

```html
<NativeSymbol name="heart.fill" icon="i-lucide-heart" label="Favourite" />
```

An SF Symbol drawn by the phone and painted in the text colour, cached in
memory for the next screen; the Iconify `icon` shows wherever there are no SF
Symbols. Common symbols have a built-in stand-in.

### And the rest

`<NativeSegmentedControl>` scrubs when its thumb is dragged, shrinks under a
finger and moves with the arrow keys. `<NativeProgressRing>` is a stroke with
rounded ends that animates to its value. `<NativeNetworkBanner>`,
`<NativeShareButton>`, `<NativePermissionButton>`, `<NativeHealthButton>` and
`<NativeAccountButton>` cover connectivity, sharing, permissions, Apple
Health and the account button.

`<NativeBarButton>` is a round button for the top right of a web screen,
drawn exactly as Craft's native bar draws its buttons: a 44pt tinted circle,
a 36pt photo inset in it, a count badge or a red dot. It takes the same SF
Symbol names as the native bar (`symbol="bubble.left"`), so an app whose
native and web screens share one list of buttons shows the same set on both.

```html
<NativeBarButton href="/m/messages" label="Messages" symbol="bubble.left" variant="accent" :badge="unread" />
<NativeBarButton href="/m/me" label="Me" symbol="person.crop.circle" badgeStyle="dot" :title="initials" :image="avatar" />
```

## The runtime

Everything is imported by name from `@stacksjs/mobile`. Every call reaches the
native implementation when the shell has it. An older shell installs its
bridge only after the page has loaded, so a call made before then waits for
it (briefly) rather than quietly taking the web path. In a browser, or on a
shell without the API, it does the closest thing the web can, or resolves
`null`/`false`. Nothing throws for being unsupported.

| API | Native | Web fallback |
| --- | --- | --- |
| `haptics.impact/notification/selection/prepare` | UIKit feedback generators | a short vibration, or nothing |
| `dialog.alert/confirm/actionSheet` | UIAlertController | an HTML alert or sheet |
| `contextMenu.show` | UIMenu | an HTML menu over the blurred page |
| `browser.open(url, { mode: 'safari' \| 'auth' })` | SFSafariViewController, ASWebAuthenticationSession | `window.open`, or a redirect for `auth` |
| `symbols.image(name)` | the SF Symbol as a PNG, cached | `null` |
| `statusBar.setStyle`, `chrome.setUnderPageColor`, `chrome.setKeyboardAccessory` | the shell's chrome | `false` |
| `refresh.enable/disable/end/onRefresh` | UIRefreshControl | `false` (use `<NativePullToRefresh>`) |
| `clipboard.write/read` | UIPasteboard | the async clipboard |
| `db.query/execute` | the app's own SQLite | `null` |
| `files.openPDF/takeScreenshot/scanQRCode/pickFile/saveFile/downloadFile` | native viewers and pickers | a tab, a file input, a download, or `null` |
| `shortcuts.set/clear/onShortcut` | home screen quick actions | `false` |
| `widgets.update/reload` | WidgetKit | `false` |
| `orientation.lock/unlock` | the shell's orientation lock | the Screen Orientation API |
| `auth.signInWithApple` | Sign in with Apple | `null` |
| `storeKit.products/purchase/restore` | StoreKit 2 (a cancelled purchase is `null`) | `[]` / `null` |

The phone's own events:

```ts
import { onAppearance, onBackgroundRefresh, onMemoryWarning, onResume, onSilentPush } from '@stacksjs/mobile'

onAppearance(({ fontScale, reduceMotion, colorScheme }) => {}) // now, and on every change
onResume(({ backgroundedMs }) => { if (backgroundedMs > 60_000) refresh() })
onMemoryWarning(() => imageCache.clear())
onSilentPush(async payload => syncInbox(payload)) // completed for iOS when it settles
onBackgroundRefresh(async () => prefetchToday()) // needs ios.backgroundRefresh
```

The existing services (`location`, `camera`, `secureStorage`, `health`,
`pushNotifications`, `share`, `speech`, `liveActivities`,
`watchConnectivity`, ...) wait for the bridge the same way.

Decide native-only chrome with `await whenNativeMobile()`, not
`isNativeMobile()` at setup, and keep native calls in components or
TypeScript composables rather than `window.*` in an STX script.
