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
