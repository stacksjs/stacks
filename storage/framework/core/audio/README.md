# @stacksjs/audio

Capability-aware audio planning, format negotiation, waveforms, and transcript normalization for Stacks.

## Process music, podcasts, and voice

```ts
import { detectAudioRuntimeCapabilities } from '@ts-audio/core'
import { audio } from '@stacksjs/audio'

const derivatives = await audio('uploads/episode.flac')
  .profile({
    codec: 'flac',
    container: 'flac',
    duration: 1842,
    sampleRate: 48_000,
    channels: 2,
  })
  .content('speech')
  .output(['opus', 'aac', 'mp3'])
  .loudness(-16)
  .runtime(await detectAudioRuntimeCapabilities())
  .process({ signal: request.signal })
```

Use `.content('music')` for music bitrate guidance, `.content('speech')` for podcasts and voice, or `.content('general')` for mixed material. AAC output uses a native ADTS `.aac` container, Opus uses Ogg, and MP3 uses its native container. `.generate()` can inspect the plan without processing it.

## Negotiation, waveform, and transcripts

```ts
import { createWaveform, negotiateAudioOutput, normalizeTranscript } from '@stacksjs/audio'

const selected = negotiateAudioOutput(plan.outputs, request.headers.get('accept') ?? '*/*')
const waveform = createWaveform(decodedChannels, sampleRate, 1200)
const transcript = normalizeTranscript('en', providerSegments)
```

Transcription remains provider-neutral. Call the provider explicitly, bind its cache key to the source hash, language, provider version, and options, then store the normalized WebVTT beside the private media.

## HLS, private CDN, and DRM

```ts
import { createProtectedAudioPlaylist } from '@stacksjs/audio'

const delivery = await createProtectedAudioPlaylist(segments, {
  key,
  keyUri: '/media/keys/episode',
})
```

Native HLS AES-128 uses Web Crypto. Proprietary DRM metadata is accepted only for already encrypted media. Publish immutable audio segments to S3 and protect manifests, keys, waveform data, transcripts, and metadata with the same CloudFront signed URL, signed cookie, or application authorization boundary.

## STX player

`<Audio>` is supplied by `@stacksjs/components`, automatically loaded by Stacks.

```stx
<Audio
  src="/media/episode/index.m3u8"
  title="Episode 12"
  artist="Stacks"
  waveform="/media/episode/waveform.svg"
  :sources="progressiveFallbacks"
  :tracks="chapterAndTranscriptTracks"
/>
```

The library player includes play, seek, time, mute, volume, speed, settings, waveform seeking, AirPlay, and Remote Playback. Native audio controls remain available before custom elements load and when JavaScript is unavailable.

`drm` accepts the same Widevine, PlayReady and FairPlay descriptors as `<Video>` and applies them to DASH sources. `artwork` supplies a cover image; `crossorigin` controls media CORS.

## Bounded speech uploads

`prepareSpeechAudio(bytes, { maxBytes, maxDurationSeconds, timeoutMs, signal })` decodes an untrusted upload to mono 16 kHz PCM WAV, measures the decoded samples and refuses audio beyond the duration limit. Defaults are 12 MiB input, five minutes and a 30-second decoder deadline. Install FFmpeg in the server runtime; an absent decoder is an explicit error. The decoder reads and writes pipes, disables external input protocols, bounds both output streams, and keeps no temporary recording files. `decoderPath` is a deployment option, never HTTP input.
