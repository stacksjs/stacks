# @stacksjs/mobile

Craft-powered mobile APIs for Stacks and STX applications. The package keeps
native capability detection, readiness, haptics, location, camera, sharing,
secure storage, lifecycle, health, Live Activities, and watch connectivity
behind one browser-safe interface.

```ts
import { haptics, isNativeMobile, location } from '@stacksjs/mobile'

if (isNativeMobile())
  await haptics.selection()

const position = await location.getCurrentPosition()
```

## Waiting for the bridge

Craft's newer iOS shell injects `window.craft` at document start; an older
one installs it once the page has loaded. A call made inside a native host
before the bridge exists now waits for it (up to `BRIDGE_WAIT_MS`, 2.5s)
instead of quietly taking the web path, and a browser takes the fallback at
once. `callNative(path, args, fallback)` and `afterBridge(run)` are the
building blocks, for a bridge API this package does not wrap yet.

## Beyond the core services

Each with a web fallback, and none throwing for being unsupported:
`dialog` (alert, confirm, actionSheet; HTML stand-ins in a browser),
`confirmAction`, `useActionSheet`, `contextMenu`, `browser.open` (in-app
Safari or an auth session), `symbols.image` (SF Symbols, cached), `statusBar`,
`chrome`, `refresh` and `observeNativeRefresh` (the native refresh control),
`background`, `clipboard`, `db`, `files`, `shortcuts`, `widgets`,
`orientation`, `auth.signInWithApple` and `storeKit`; the phone's events
`onAppearance`, `onResume`, `onMemoryWarning`, `onSilentPush` and
`onBackgroundRefresh`; and `haptics.prepare()`. The gesture logic behind the
Native components (sheet detents, the large title, long press, segment
scrubbing, pressables, the chrome sync) is exported too. See the
[Mobile Apps guide](https://stacksjs.org/guide/mobile).

## Native bridge availability

`mobile` is a typed service collection (`MobileApi`), available in both browsers
and native apps. Its services keep Craft's existing web fallbacks. Use
`getNativeMobileBridge()` or `mobile.nativeBridge` for native-only feature checks:

```ts
import { getNativeMobileBridge, mobile } from '@stacksjs/mobile'

const bridge = getNativeMobileBridge()
if (bridge?.capabilities.backgroundLocation === true)
  await mobile.location.startRecording({ enableHighAccuracy: true })

const unsubscribe = mobile.onReady(() => {
  const current = mobile.nativeBridge
  const hasHealth = current?.platform === 'ios'
    ? current.capabilities.healthKit === true
    : current?.capabilities.health === true
  // Update capability-specific UI with hasHealth.
})
```

Both accessors return `CraftMobileBridge | null`. They read the current host on
each call, so late bridge injection is visible without reimporting the package.
Browsers, server rendering, and desktop Craft hosts return `null`. Mobile hosts
report their native `ios` or `android` platform, independent of the user agent.
Call `unsubscribe()` when disposing the readiness listener.

`CraftMobileBridge` exposes read-only metadata, not raw native methods. Its
`capabilities` uses Craft's enabled-feature names, including `geolocation`,
`biometric`, iOS `healthKit`, and Android `health` (Health Connect). A missing or
non-boolean flag is `undefined`, never implicitly enabled. Older hosts without a
capability map return an empty map. These flags are distinct from the hardware
report returned asynchronously by `mobile.device.getCapabilities()` and do not
replace permission requests or error handling. Invoke operations through the
typed services, not through the metadata object.

The `health` facade reads authorized Apple Health or Android Health Connect
metrics and writes completed workouts using one payload. `watchConnectivity`
keeps companion controls and recording state synchronized without exposing
platform bridge globals to application code.

### Reading Apple Health

`health.getWorkouts()` lists the workouts in Apple Health — the watch's, and
every app's that writes there — newest first, with duration, distance, energy,
heart rate and elevation, keyed on HealthKit's UUID so an import can be run
again without duplicating. `health.getDailyStatistics(type)` returns one value
per local day: a sum for `steps`, `activeEnergy` and `distance`, an average for
`heartRate`, `restingHeartRate` and `heartRateVariability`, the latest
`bodyMass`, and hours asleep for `sleep`, counted on the day you woke.

```ts
import { health } from '@stacksjs/mobile'

await health.requestAuthorization(['workouts', 'heartRate', 'sleep', 'heartRateVariability'])
const workouts = await health.getWorkouts({ startDate: Date.now() - 30 * 86400000 })
const hrv = await health.getDailyStatistics('heartRateVariability', { startDate: Date.now() - 30 * 86400000 })
```

Both are iOS only for now; on Android they reject as unavailable.

## Recording a route

Craft records the route natively: fixes go to disk, keep coming with the screen
locked (`capabilities.backgroundLocation`), and survive the app being closed.
`createRouteRecorder` drives that recording and reads it back every few seconds
while the page is in front, turning it into the numbers a runner watches:

```ts
import { createRouteRecorder, location, paceLabel } from '@stacksjs/mobile'

const recorder = createRouteRecorder({
  location,
  onUpdate: stats => console.log(stats.distanceM, paceLabel(stats.paceSPerKm)),
})

await recorder.attach() ?? await recorder.start() // pick up a recording that outlived the app
await recorder.pause()
await recorder.resume()
const fixes = await recorder.stop() // every fix, for the server to keep
```

`routeStats(fixes)` is the arithmetic on its own: distance counted from an
anchor so GPS drift while standing still adds nothing, fixes less accurate than
25 m left out, a gap of more than `ROUTE_GAP_S` (a pause) not counted as ground
covered, moving time, and pace over the last 30 seconds and the whole route.
`paceLabel` and `speedLabel` format min/km and km/h.

## Before the bridge arrives

Craft installs `window.craft` once the page has finished loading, so
`isNativeMobile()` answers `false` during setup on a phone. A decision made
then — hide the website's header, show the app's tab bar — needs the answer
when it is right:

```ts
import { hasNativeMobileHost, whenNativeMobile } from '@stacksjs/mobile'

hasNativeMobileHost() // true inside the phone shell, even before the bridge
const native = await whenNativeMobile() // resolves once it knows, false in a browser
```

## Device search index

What a device may index is configuration (`config/mobile.ts`, `spotlight`): one
entry per kind of content, with the number of slots it may claim, the route a
tapped entry opens, and the noun that names a record with no name of its own.

```ts
import mobileConfig from '../config/mobile'
import { createSpotlightIndex, onSpotlightTap } from '@stacksjs/mobile'

const spotlight = createSpotlightIndex({ kinds: mobileConfig.spotlight.kinds })

await spotlight.index('trail', { id: 42, name: 'Eagle Peak Loop' })
await spotlight.sync('club', myClubs)
await spotlight.remove('club', 7)
await spotlight.clear()
onSpotlightTap(spotlight, route => location.assign(route))
```

iOS indexes donated `NSUserActivity` objects — Craft's `siri` bridge — and
hands a tapped one back only for an activity type the build declares in
`Info.plist`, a list fixed at build time. A type per record id cannot be
declared, so each kind gets a fixed number of slots, each slot holds whichever
record is in it, and the oldest donation makes room; `buddy build:ios` writes
the declarations from the same config.

Every call is a no-op that reports as much off a native host, on a build whose
host predates the bridge, in a WebView with no `localStorage`, and where the
index is turned off, so a page can donate unconditionally.

## Page gestures and navigation

The phone-native behaviour a screen expects, kept out of STX templates:

- `observePullToRefresh({ onRefresh, onPull, threshold })` pulls the page down
  from its top. On iOS it rides the system's rubber band; elsewhere the finger's
  travel drives it. Crossing the threshold taps the haptic engine once.
- `observePageScroll(offset => …)` reports the scroll offset at most once a
  frame, for a bar that collapses as the page scrolls.
- `goBack()` goes back through history when the app pushed the current screen,
  and answers `false` otherwise so a back button follows its own link and never
  leaves the app.

The framework's `NativeNavBar`, `NativePullToRefresh`, `NativeSegmentedControl`
and `NativeSheet` components are built on these.
