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
`bodyMass`, and hours asleep for `sleep`, counted on the day you woke. What a
food log (MyFitnessPal, Lose It!, Cronometer) writes there comes in as a day's
sum too: kcal for `dietaryEnergy`, grams for `dietaryProtein`,
`dietaryCarbohydrates` and `dietaryFat`. Those four are read only.

```ts
import { health } from '@stacksjs/mobile'

await health.requestAuthorization(['workouts', 'heartRate', 'sleep', 'heartRateVariability'])
const workouts = await health.getWorkouts({ startDate: Date.now() - 30 * 86400000 })
const hrv = await health.getDailyStatistics('heartRateVariability', { startDate: Date.now() - 30 * 86400000 })
```

Both are iOS only for now; on Android they reject as unavailable.

For a day chart, `health.getHeartRateSamples({ startDate, endDate })` returns
every heart-rate reading in the range, oldest first (bpm, start and end, the
source app and the device), and `health.getSleepIntervals({ startDate, endDate })`
returns the night as the sources wrote it: in bed, awake, and each asleep stage
with `asleep` set. Both read under the `heartRate` and `sleep` grants. An app
installed before these reads existed cannot answer them, so they resolve `[]`
there and in a browser; `health.supports('getHeartRateSamples')` says whether
the running build can, so a page can hide what needs it.

```ts
if (health.supports('getHeartRateSamples')) {
  const readings = await health.getHeartRateSamples({ startDate: Date.now() - 86400000 })
  const nights = await health.getSleepIntervals({ startDate: Date.now() - 86400000 })
}
```

Mindful minutes: ask for `mindful` with writing allowed, then
`health.saveMindfulSession({ id, startDate, endDate })` records a meditation or
breathing session. The id is kept as the sample's external UUID, so saving it
again keeps the first sample (`existing: true`). `health.getMindfulSessions(range)`
reads every app's sessions back, oldest first, with `ownApp` set on the ones this
app wrote, so an import can skip its own. Both are iOS only for now and need
Craft 0.0.161; an older build resolves `null` and `[]`.

```ts
await health.requestAuthorization(['mindful'], { write: true })
if (health.supports('saveMindfulSession'))
  await health.saveMindfulSession({ id: session.id, startDate: started, endDate: Date.now() })
const others = (await health.getMindfulSessions({ startDate: Date.now() - 7 * 86400000 })).filter(row => !row.ownApp)
```

Heart rate as it arrives: `health.startHeartRateUpdates({ since })` streams
Apple Health's heart rate (an HKAnchoredObjectQuery) from `since` (two minutes
ago by default): what is there, then each batch the watch syncs, every reading
once, to `health.onHeartRate(samples => …)` in `getHeartRateSamples`' shape.
HealthKit only has what the watch has synced: every few seconds while the
watch runs a workout or a Mindfulness session, every few minutes otherwise.
One stream at a time; `stopHeartRateUpdates()` ends it. Needs the `heartRate`
grant and Craft 0.0.166; an older build resolves `false` (poll
`getData('heartRate', …)` instead), and a simulator build can stand in a watch
with the `CraftFakeHealthHeartRate` default.

```ts
const stop = health.onHeartRate(samples => samples.forEach(sample => draw(sample.bpm, sample.endDate)))
if (!await health.startHeartRateUpdates({ since: Date.now() - 120_000 })) stop()
// later
stop()
await health.stopHeartRateUpdates()
```

## Heart-rate strap

`heartRate` reads a Bluetooth heart-rate strap (Polar, Garmin, Wahoo), or a
watch broadcasting its heart rate, through the standard Heart Rate Service.
`scan` finds straps nearby (`onDevice` hears each), `connect(id)` subscribes
to its readings (`onReading`: bpm and RR intervals, about once a second) and
remembers it, so `reconnect()` finds it next time without a scan; a strap that
drops out is asked for again until `disconnect()`. `startRecording()` keeps
every reading natively, screen locked or app closed, until `stopRecording()`
hands them back. iOS only, behind `capabilities.heartRate` (which adds the
`bluetooth-central` background mode); Bluetooth needs no network.

`capabilities.backgroundAudio` (iOS) adds the `audio` background mode, so a
soundscape played with Web Audio keeps going with the screen locked: a sleep
timer built on stx's `useAmbientSound().fadeOut(seconds, after)` then fades it
out on the audio clock. App Review expects audible content from an app that
asks for it.

```ts
import { createRouteRecorder, heartRate, location } from '@stacksjs/mobile'

const stop = heartRate.onDevice(device => list.push(device)) // { id, name, rssi }
await heartRate.scan({ timeout: 15 })        // can show iOS's Bluetooth prompt
await heartRate.connect(list[0].id)          // rejects TIMEOUT while still asking
heartRate.onReading(reading => show(reading.bpm))

// With a route: the strap records with it, and each fix gets its heart rate.
const recorder = createRouteRecorder({ location, heartRate })
await recorder.start()
const fixes = await recorder.stop()          // fixes[i].heartRate
const samples = recorder.heartRate           // every reading: { timestamp, bpm, rr? }
```

Without a route, record it on its own (`heartRate.startRecording()` /
`stopRecording()`), and `attachHeartRate(fixes, samples)` pairs readings
with fixes recorded separately. In a browser and on Android `isAvailable()` is
false, the state says `available: false` and nothing fires. Word iOS's prompt
with `ios.usageDescriptions.NSBluetoothAlwaysUsageDescription`.

## Apple Watch scheduled workouts

`scheduledWorkouts` puts structured workouts on the paired Apple Watch through
WorkoutKit's scheduler (iOS 17+): each appears in the watch's Workout app on
its day, with its warmup, repeated blocks, cooldown, goals and alerts. iOS
only, behind `capabilities.scheduledWorkouts`; only an app with it compiles in
and links WorkoutKit. The calls work on the page and on native stx screens.
A plan is plain JSON in SI units, its `id` a UUID the app keeps for it.

```ts
import { scheduledWorkouts } from '@stacksjs/mobile'

if (await scheduledWorkouts.isSupported()) {           // false off an iPhone, never rejects
  await scheduledWorkouts.requestAuthorization()       // iOS's prompt, once; call it from a tap
  const kept = await scheduledWorkouts.list()          // [{ id, date, hour, minute, complete }]
  await scheduledWorkouts.schedule({
    id: '6f1c2b8e-5a7d-4c3e-9b1a-2d4e6f8a0b1c',
    date: '2026-10-20', hour: 6, minute: 30,           // local; 07:00 without a time
    workout: {
      activity: 'running', location: 'outdoor', displayName: '4 x 1 km',
      warmup: { goal: { type: 'time', seconds: 600 } },
      blocks: [{ iterations: 4, steps: [
        { purpose: 'work', step: { goal: { type: 'distance', meters: 1000 }, alert: { type: 'speed', min: 4.1, max: 4.4 } } },
        { purpose: 'recovery', step: { goal: { type: 'time', seconds: 120 } } },
      ] }],
    },
  })
  await scheduledWorkouts.remove(kept[0].id)          // every day it is on
}
```

Goals are `open`, `time` (seconds), `distance` (meters) and `energy`
(kilocalories); alerts `heartRate`, `power`, `speed` (m/s), `cadence` ranges and
`heartRateZone` / `powerZone`. An activity or goal WorkoutKit refuses rejects
the call with a message naming it; an alert it refuses is left out and named
in the result's `droppedAlerts`. `schedule` also rejects LIMIT_REACHED (the
watch holds 15) and NOT_SCHEDULED when nothing kept the plan, as without a
paired watch. In a browser and on Android `isSupported()` is false and every
other call rejects `unsupported`.

For tests, `createScheduledWorkoutsFake()` from `@stacksjs/mobile/testing` is a
`craft.scheduledWorkouts` that answers like the shell. On the iOS simulator,
which never has a watch, the app's `CraftFakeWorkoutScheduler` default makes
the shell keep plans itself (`xcrun simctl spawn <device> defaults write <bundle id> CraftFakeWorkoutScheduler -bool YES`).

## Apple Music

`music` shows what the Music app is playing (title, artist, album, a small
artwork data URL, duration, position, playback state) and steers it: `play`,
`pause`, `togglePlayPause`, `skipToNext` and `skipToPrevious`, which restarts
the song a few seconds in, like the Music app's own button. Changes arrive
from native as they happen, so a page never polls. iOS only, behind
`capabilities.appleMusic`; music control is local to the phone, so it works
offline.

```ts
import { music } from '@stacksjs/mobile'

// From the person's tap, never on load: iOS shows its prompt the first time.
if (await music.requestAuthorization() === 'authorized') {
  render(await music.getNowPlaying())
  const stop = music.onChange(render) // observes while anyone listens
  await music.togglePlayPause()
}
```

Only Apple Music: iOS gives no app the controls of another player, Spotify
included, so while one plays the song fields are null and `otherAudioPlaying`
is true; say so rather than show controls that do nothing. Nothing is read
before access is allowed (`authorization` is `notDetermined`, `denied` or
`restricted` until then). In a browser and on Android `isAvailable()` is false,
every call answers `{ available: false }` and `onChange` never fires. Word the
prompt with `ios.usageDescriptions.NSAppleMusicUsageDescription`. The
simulator's Music app has nothing to play; launch a simulator build with
`-CraftFakeMusicPlayer YES` for three made-up songs that play and skip.

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

if (savedRecordingId) await recorder.attach({ expectedId: savedRecordingId })
else await recorder.start()
await recorder.pause()
await recorder.resume()
const fixes = await recorder.stop() // every fix, for the server to keep
```

`savedRecordingId` must come from the signed-in account's workout draft. Save
`recorder.recordingId` after a successful start and keep it with that draft.
An unknown ID or another active recording is a conflict, never permission to
adopt or replace the global recording. The ID remains available after stopping
so a delayed completion can be kept for its original account. An explicitly
owned completed recording can also be attached and stopped again after a lost
acknowledgement; check the attached state's `active` before pausing or resuming.
Guarded metadata, reads and stop resolve that recording's retained archive even
when a different athlete has since started a new route.

When the controller also records heart rate, persist
`recorder.heartRateRecordingId` and recover it with
`attach({ expectedId, expectedHeartRateId })`. Omitting the heart-rate ID leaves
the existing heart-rate recording untouched. Both the SDK adapter and native
host must support recording ownership; guarded operations otherwise reject with
`RECORDING_OWNERSHIP_UNSUPPORTED`. A changed recording rejects with
`RECORDING_CONFLICT` before reading or changing its data. The recorder never
automatically releases native data. After durably keeping the result under its
original account, call `location.acknowledgeRecording({ expectedId })` (and
`heartRate.acknowledgeRecording` for a bundled strap). A failed checkpoint must
leave that native copy available; acknowledge a discarded recording only after
the account's discard is durable.

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

## Sheets and the overlay stack

A bottom sheet's own behaviour lives here: `observeSheetDrag` (dragged by its
grabber or header between `medium` and `large` detents, flicked away),
`liftToBody` (out of the page's stacking contexts, before its content loads
media), `coverTabBar` and `presentPageAsCard`, which is counted, so the page
stays a card until the last large sheet lets go.

What every overlay shares is not here. Holding the page still and inert,
Escape for whichever layer is on top, the Tab trap and handing focus back are
stx's overlay stack (`openOverlay` / `closeOverlay` from
`@stacksjs/components/overlays`, the runtime's `window.stx.overlays`).
`NativeSheet` and the HTML stand-ins for alerts, action sheets and context
menus are layers on it, alongside `Dialog`, `Drawer` and `stxConfirm`, so a
confirmation opened from a sheet, or a sheet opened over a drawer, closes with
one Escape and leaves the layer under it up and locked. `lockBackground` and
`trapFocus`, which did this per sheet and fought the stack, are gone; an
overlay of your own joins the stack instead:

```ts
import { closeOverlay, openOverlay } from '@stacksjs/components/overlays'

openOverlay('route-picker', { panel: () => panelEl, root: sheetEl, zIndex: 70, onEscape: close })
closeOverlay('route-picker')
```

`root` is an element lifted into `<body>`: the rest of the page goes inert
behind it, and stays inert while a dialog opened inside it is on top. With
`zIndex`, a layer opened later draws above one opened earlier wherever the two
sit in the document.

## Native source ownership

Stacks applications author TypeScript and STX. Craft distributes reusable Swift
shells inside its package, and `buddy build:ios` generates them under
`storage/framework/mobile/ios`. Generated Swift is ignored by the project's
generated `.gitignore`, including optional watch and widget sources. Application
configuration belongs in typed `config/mobile.ts`, rather than generated Swift.

The build also generates executable `ci_scripts/ci_post_clone.sh`. Keep that hook,
Xcode metadata, `craft.config.json`, assets, compiled native bundles and `bun.lock`
in Git when using Xcode Cloud. The hook installs frozen dependencies and restores
Swift from the installed Craft package without changing project metadata. It
installs Bun when unavailable, using `ios.shell.bunVersion` or the Bun version
that generated the project. Another CI can call `restoreIosShell(output)` after
installing dependencies. Rebuild metadata and bundles when config or Craft changes.
Existing apps must remove previously tracked Swift with `git rm --cached`; ignore
rules do not untrack files already committed.

When the app's root `.gitignore` excludes the whole mobile directory, unignore
`/storage/framework/mobile/`, ignore its children with
`/storage/framework/mobile/*`, then unignore `/storage/framework/mobile/ios/`.
Keep build products and `xcuserdata` ignored. This admits cloud metadata while
the generated iOS `.gitignore` excludes Swift.

## Bun-only test tooling

```ts
import { prepareIosSimulatorDriver, serializeSimulatorSteps } from '@stacksjs/mobile/testing'
import mobile from './config/mobile'

const { output, projectName } = prepareIosSimulatorDriver(mobile.ios)
const script = serializeSimulatorSteps([
  { command: 'launch' },
  { command: 'expect', text: 'Today', seconds: 10 },
])
```

The generated test host defaults to `storage/framework/mobile/ios-driver`, targets
`ios.bundleId`, and derives tab labels from `ios.tabs`. Customize its output,
project name, bundle prefix, iOS deployment target (17+), and control URL through
`ios.simulator`. Generate with xcodegen and run with xcodebuild against an installed
app. Serve the serialized journey at `/script` and accept `/note` and `/save` on
the control server. `TEST_RUNNER_CRAFT_TEST_CONTROL` overrides the URL per run.
Legacy line-based scripts remain supported; failed checks also fail XCTest.

`createNativeMutationValidator()` validates captured STX messages against the
package's real Swift mutation host on macOS. It returns a disposable validator
whose `validate(messages)` reports `exitCode`, `stdout` and `stderr`.

The `/testing` entrypoint is for Bun build/test tools and is excluded from browser
exports. The ordinary `@stacksjs/mobile` entrypoint stays browser-safe. Extend
Craft's shared host and typed APIs for new platform features instead of editing
generated sources.
