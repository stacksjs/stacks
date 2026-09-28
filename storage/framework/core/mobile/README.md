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

