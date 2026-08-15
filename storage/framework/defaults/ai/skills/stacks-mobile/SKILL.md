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
supported web APIs provide fallback behavior outside a native host.

## STX components

- `<NativeAppShell>` applies iOS safe-area insets and reserves tab-bar space.
- `<NativeTabBar>` provides the accessible navigation shell and selection haptics.
- `<NativeTabItem>` provides each route, active state, label, and Iconify icon.
- `<NativeShareButton>` opens the native share sheet and reports feedback.
- `<NativeNetworkBanner>` reflects native connectivity changes and announces offline state accessibly.
- `<NativePermissionButton>` wraps permission status, requests, haptics, and the native Settings escape hatch.
- `<NativeHealthButton>` requests the minimal Apple Health or Android Health Connect grants.

Use Iconify classes for tab icons. Keep native operations inside reusable
components or TypeScript composables, never through `window.*` in an STX
script.

## Health and watch surfaces

Enable `healthKit` on iOS or `healthConnect` on Android, then use the shared
`health` service to request only the record types the product needs. Completed
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
