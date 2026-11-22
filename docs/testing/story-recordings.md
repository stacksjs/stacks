# User story videos

`buddy docs:stories` runs named end-to-end scenes, records an MP4, captures a PNG after every reached scene, and adds a documentation page containing the video and all scene screenshots. The generated index links every configured story and shows its result. Browser, iOS Simulator and Android Emulator recordings use the same command.

A story records one journey you script, with its clicks and typing. To picture every screen of the application without scripting anything, use [screen documentation](/guide/screenshots) instead; [Screens or stories?](/guide/screenshots#screens-or-stories) compares the two.

Browser stories need Chrome and nothing else: Chrome encodes the video through WebCodecs and ts-videos, a TypeScript library, writes the MP4. Native stories also need FFmpeg, which draws the tap indicators onto the device's own recording. Native stories need an explicitly selected, booted simulator or emulator with your app already installed. The recorder leaves device provisioning, app installation, fixtures and account setup with your existing E2E workflow.

## Browser stories

Create `config/stories.ts`:

```ts
import { defineStory, defineStoryConfig } from '@stacksjs/docs/stories'
import { browserStory } from '@stacksjs/docs/story-drivers'

export default defineStoryConfig({
  title: 'Product walkthroughs',
  outDir: 'docs/stories',
  fps: 12,
  holdMs: 700,
  inputs: ['tests/e2e/checkout.ts'],
  stories: [
    defineStory({
      id: 'checkout-browser',
      title: 'Place an order',
      description: 'A synthetic customer reviews a cart and confirms a purchase.',
      driver: browserStory({
        baseUrl: 'http://localhost:3000',
        viewport: { width: 1280, height: 800 },
        masks: ['[data-private]'],
        cursor: { color: '#2563eb', size: 18, moveMs: 450, clickMs: 400 },
      }),
      scenes: [
        {
          id: 'cart',
          title: 'Review the cart',
          description: 'Check the products before continuing.',
          async run(view) {
            await view.goto('/cart')
            await view.expectText('h1', 'Your cart')
          },
        },
        {
          id: 'confirmed',
          title: 'Confirm the order',
          async run(view) {
            await view.click('[data-test="checkout"]')
            await view.expectText('h1', 'Order confirmed')
          },
          holdMs: 1200,
        },
      ],
    }),
  ],
})
```

```sh
./buddy docs:stories --list
./buddy docs:stories
./buddy docs:stories --check
```

Use `defineStory()` to infer scene context from its driver. Scenes contain real actions and assertions. Move existing E2E functions into scene callbacks instead of maintaining a separate demonstration script. `view.cdp` exposes the existing testing CDP session for application-specific assertions. `view.goto()` stays on the configured origin, waits for document/network readiness and requires HTTP 200. Use `view.goto('/missing', { expectedStatus: 404 })` for an intentional error scene. `view.type(selector, text)` clicks the field and inserts text through Chrome's input protocol.

The visible circular mouse pointer follows real `mouseMoved` input. Clicks use the testing package's guarded click helper and show a pulse at the delivered pointer-down position. Use `view.click()` and `view.type()` for this visible movement; raw CDP input bypasses movement choreography. Video uses actual Chrome screencast frames at the configured frame rate, repeating the last display frame during idle periods so pauses retain their duration. No audio is recorded. Console and network errors retained by the browser testing session fail the recording. Set `failOnBrowserErrors: false` only when the journey explicitly asserts intentional error behavior itself.

Each story gets a separate browser context. Use `beforeNavigate(cdp)` to configure HTTP authentication or browser cookies before the first request. For a preview protected by HTTP Basic authentication, call `installBasicAuth` from `@stacksjs/testing/browser` there with the story origin and credentials from your secret manager. `prepare(context)` on `browserStory()` can establish synthetic authentication before recording starts. Password inputs and configured mask selectors become transparent before document scripts and the first recorded frame, while remaining actionable. Masks do not cover browser dialogs, canvas contents or unrelated elements. Use synthetic accounts and add selectors for personal content before sharing any recording.

## Native stories

`nativeStory()` records the actual OS display with `simctl recordVideo` or Android `screenrecord`. It never uses a browser viewport as native evidence.

```ts
import { defineStory } from '@stacksjs/docs/stories'
import { nativeStory } from '@stacksjs/docs/story-drivers'

const androidCheckout = defineStory({
  id: 'checkout-android',
  title: 'Android checkout',
  driver: nativeStory({
    platform: 'android',
    device: 'emulator-5580',
    tapColor: '#2563eb',
    tapMs: 450,
  }),
  scenes: [{
    id: 'confirmed',
    title: 'Confirm the order',
    async run(view) {
      // Resolve this point from the target's current UIAutomator bounds.
      await view.tap(540, 1200)
      // Assert the resulting state using your existing native E2E driver.
    },
  }],
})
```

Coordinates are display pixels, including system bars. Android defaults to `adb input` for taps, swipes and simple ASCII text. Its text helper intentionally rejects shell-sensitive characters and Unicode; supply your driver's `input.type` for those values. `view.swipe(from, to, durationMs)` delegates to the native input adapter. Resolve fresh target bounds in your existing UI automation rather than copying coordinates between devices.

iOS needs an XCTest or Appium input adapter because `simctl` does not provide app tap injection:

```ts
import { nativeStory } from '@stacksjs/docs/story-drivers'

declare const nativeDriver: {
  tapDisplayPixels: (x: number, y: number) => Promise<void>
  type: (text: string) => Promise<void>
}

const iosDriver = nativeStory({
  platform: 'ios',
  device: process.env.STORY_IOS_DEVICE!,
  input: {
    async tap(x, y) {
      // Call your running XCTest/Appium driver's tap operation here.
      // Convert screenshot pixels to that driver's coordinate space.
      await nativeDriver.tapDisplayPixels(x, y)
    },
    async type(text) {
      await nativeDriver.type(text)
    },
  },
})
```

`nativeDriver` above is your existing native test harness. The recorder owns capture and documentation; the harness owns target resolution, actions and assertions. An input operation must resolve only after the real native action and any associated assertions complete. Calling `view.tap()` adds visible tap feedback to the recorded video from action start through completion plus `tapMs`. These are action intervals, rather than hardware event timestamps. Actions called directly on the external harness bypass the recorder's indicators. Native screenshots contain the unmodified OS display. Tap feedback is added to the video during encoding.

Native capture includes system UI and has no automatic redaction. Provision dedicated synthetic devices. Android has a platform recording limit of 180 seconds: split longer journeys into separate stories. The command fails if a recorder stops before normal finalization. It signals only the recording it started and removes only its unique remote recording file. It never clears app data, restarts a device or cancels another recording.

## Configuration and outputs

| Setting | Default | Purpose |
| --- | --- | --- |
| `outDir` | `docs/stories` | Generated Markdown, video, screenshots and manifest |
| `publishDir` | `docs/public/stories` | Media copied automatically for BunPress, or `false` to disable |
| `title` | `User stories` | Generated index title |
| `fps` | `12` | Output video frames per second, from 1 to 60 |
| `holdMs` | `700` | Readable pause before each screenshot, from 0 to 30000 |
| `timeoutMs` | `120000` | Scene deadline; aborts the run and disposes its capture resources |
| `scene.holdMs` | Global value | Override the pause for one scene |
| `scene.timeoutMs` | Global value | Override one scene's deadline |
| `inputs` | `[]` | Additional imported journey or fixture files checked for freshness |
| `browser.cursor` | Blue, 18px | Pointer color, size, movement and click timing |
| `browser.masks` | Password inputs | Additional selectors hidden throughout browser capture |
| `native.input` | Android adb | Existing native driver operations; required for iOS |
| `native.tapFeedback` | `true` | Add tap indicators, or use the harness's own indicators |
| `native.tapColor`, `tapSize`, `tapMs` | Blue, 72px, 450ms | Native tap indicator appearance and trailing duration |
| `chromePath`, `adb`, `xcrun` | Installed tools | Explicit executable paths on controlled runners |
| `native.ffmpeg` | `ffmpeg` from PATH | FFmpeg for native recordings only |

`--config path` selects another config, `--out directory` overrides its destination, and `--only a,b` selects stories. `--json` returns a machine-readable report. `--list` validates the inventory without opening drivers or running scenes. Config files are executable TypeScript, so keep device setup inside `open`, `prepare` or scene callbacks rather than at module scope.

The default output sits directly in the docs source tree. The command automatically creates the index and each story's page, embeds its MP4 and lists every scene with its screenshot. Pages and media use relative links and can be shared together. It also copies video and screenshots to the sibling `public/<output-folder>` directory, which BunPress includes automatically in the built site. When using a custom destination, set `publishDir` to the public directory matching the story pages' URL path, or use `false` for a standalone Markdown bundle. Add `/stories/` to your site's navigation when you want it in a permanent menu.

Every capture receives a unique `runs/<run-id>/` directory. The command retains older runs, creates an ownership marker and refuses an unowned destination or a handwritten index. It never deletes old evidence automatically. A lock prevents concurrent writers. After an interrupted command, inspect the recorded PID before removing a stale `.recording.lock`.

A scene screenshot is taken after its callback and assertions, including a callback that throws if capture is still available. Later scenes remain `not-run`. Failed stories still receive a report page, and the command exits unsuccessfully. Scene callbacks receive an `AbortSignal` as their second argument; pass it to external operations so deadlines and interrupts can cancel your harness work too. Public reports deliberately omit exception messages because those can contain credentials or typed fixture values. Programmatic callers can use `recordStories({ onError(error, storyId) {} })` for trusted diagnostics.

`--check` starts no browser or device. It requires every configured story and scene to have passed, verifies configuration and additional input hashes, and checks every generated page, screenshot and video against its saved SHA-256. A partial `--only` recording remains visibly incomplete and cannot pass the full check. Add imported journey files to `inputs` so editing them invalidates previous evidence.

## Verify a native integration

The framework includes opt-in real native fixture tests. They compile and install a distinct test app, exercise a native purchase button, record both scenes through Buddy, decode the MP4 and verify the generated documentation and freshness check.

```sh
STACKS_STORY_IOS_DEVICE=<disposable-simulator-uuid> \
  ./buddy test storage/framework/core/docs/tests/stories-native.test.ts

ANDROID_HOME=<android-sdk> STACKS_STORY_ANDROID_DEVICE=emulator-5580 \
  ./buddy test storage/framework/core/docs/tests/stories-native.test.ts
```

The iOS test needs Xcode and XcodeGen. The Android test needs Java, Android 35 platform/build tools and a booted emulator. These tests never choose or delete devices. Use disposable devices that your own workflow provisions and cleans up.
