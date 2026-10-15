# @stacksjs/video

Deterministic, capability-aware video planning for Stacks. Unsupported codec operations fail early instead of being mislabeled as remuxing.

## Inspect, plan, and process

```ts
import { detectVideoRuntimeCapabilities } from 'ts-videos'
import { video } from '@stacksjs/video'

const delivery = await video('uploads/demo.mp4')
  .profile({
    width: 1920,
    height: 1080,
    duration: 92,
    frameRate: 30,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
  })
  .ladder('auto')
  .output(['mp4', 'webm'])
  .streaming(['hls', 'dash'])
  .runtime(await detectVideoRuntimeCapabilities())
  .process({ signal: request.signal })
```

`.generate()` returns the deterministic plan without processing. `.process()` executes its container and rendition matrix through native WebCodecs and the built-in MP4 or WebM muxers. The same call returns progressive files, CMAF segments, HLS and DASH manifests, poster art, preview sprites, and preview WebVTT when the native preview runtime is available. Compatible packets are copied, real codec changes are encoded, scaling never upscales, metadata is preserved, and work runs in bounded batches.

```ts
await storage.putMany(delivery.files)
```

## HLS, DASH, and protected delivery

```ts
import { createAdaptiveDeliveryBundle } from 'ts-videos/protected-delivery'

const bundle = await createAdaptiveDeliveryBundle(plan, segmentedRenditions, {
  hlsAes128: {
    key,
    keyUri: '/media/keys/demo',
  },
  drm: {
    descriptors: [{ system: 'widevine', keyId, licenseUrl }],
    dashSegmentsEncrypted: true,
  },
})
```

HLS AES-128 is performed with Web Crypto. Widevine, PlayReady, FairPlay, and ClearKey descriptors require already encrypted CENC or SAMPLE-AES media. Clear segments cannot be labeled as proprietary DRM content.

For hosted delivery, publish immutable segments to S3 and use the media helpers from `ts-cloud`:

```ts
import { buildMediaCdnPlan, signCloudFrontCookies } from 'ts-cloud'

const cdn = buildMediaCdnPlan({
  bucket: 'example-media',
  region: 'us-west-2',
  domain: 'media.example.com',
  protected: true,
})
const cookies = signCloudFrontCookies({ resource: 'https://media.example.com/demo/*', expires }, signer)
```

Manifests remain short-lived or private, while content-addressed segments use immutable caching. Key routes must enforce the same application authorization or signed audience boundary.

## STX player

`<Video>` is the player from `@stacksjs/components` (ts-video-player), which every Stacks app loads:

```stx
<Video
  src="/media/demo/manifest.mpd"
  label="Product demonstration"
  poster="/media/demo/poster.avif"
  :sources="progressiveFallbacks"
  :drm="licenseEndpoints"
  :tracks="captionAndChapterTracks"
/>
```

It plays a file, an HLS or DASH stream, or a YouTube or Vimeo link, with play, seek, live edge, time, mute, volume, speed, quality, captions, AirPlay, Picture in Picture, fullscreen and accessible errors, labelled in the page's language. `src`, `poster`, `aspectRatio` and `label` follow a binding. See the component's README in `@stacksjs/components` for every prop.

`drm` accepts Widevine, PlayReady and FairPlay license endpoints for already encrypted media:

```ts
const licenseEndpoints = {
  widevine: { url: '/licenses/widevine', headers: { Authorization: token } },
  playready: { url: '/licenses/playready' },
  fairplay: { url: '/licenses/fairplay', certificateUrl: '/licenses/certificate' },
}
```

The component serializes these descriptors into `data-media-config` and attaches them to DASH sources, detected by MIME type or a `.mpd` URL (including query strings). Progressive fallback sources remain unchanged. License and certificate routes must authorize the viewer.
