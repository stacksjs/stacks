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
- iOS build action: `storage/framework/core/actions/src/build/ios.ts`
- Reusable STX components: `storage/framework/defaults/resources/components/Native*.stx`
- Generated iOS project: `storage/framework/mobile/ios/` (ignored build output)

## Build

```bash
buddy build:ios
```

The build validates `config/mobile.ts`, initializes a Craft iOS project,
selects either a remote application URL or bundled web assets, generates the
Xcode project with xcodegen, and records source/capability provenance in
`stacks-mobile.json`.

For local Craft development, point Stacks at Craft's builder source:

```bash
CRAFT_IOS_SRC=/absolute/path/to/craft/packages/ios/src/index.ts buddy build:ios
```

`STACKS_IOS_SKIP_XCODEGEN=1` is only for source-level CI and tests. A shippable
iOS project must be generated and then compiled with Xcode.

## Configuration

```ts
import type { MobileConfig } from '@stacksjs/types'

export default {
  ios: {
    appName: 'My App',
    bundleId: 'com.example.app',
    url: 'https://example.com',
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
} satisfies MobileConfig
```

Choose exactly one content source:

- `url`: load the deployed Stacks application and keep server-rendered routes.
- `webAssets`: bundle a static distribution containing `index.html` and every
  referenced asset.

Only enable capabilities the product uses. Craft turns enabled capabilities
into native bridge availability and required iOS privacy descriptions.

## Runtime API

```ts
import { haptics, location, share, withNativeFeedback } from '@stacksjs/mobile'

await haptics.selection()
const position = await location.getCurrentPosition({ enableHighAccuracy: true })
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

Use Iconify classes for tab icons. Keep native operations inside reusable
components or TypeScript composables, never through `window.*` in an STX
script.

## Validation

Before finishing mobile work:

```bash
buddy lint
bun run typecheck:app
buddy test
buddy build:ios
```

On a Mac with full Xcode selected, compile the generated project for an iOS
Simulator and a physical-device archive. Verify permission prompts, safe-area
layout, deep links, offline/error states, background transitions, and native
feedback on device.
