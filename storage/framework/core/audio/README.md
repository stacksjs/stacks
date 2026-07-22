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

## Default STX player

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

The default UI includes play, seek, time, mute, volume, speed, settings, waveform seeking, AirPlay, and Remote Playback. Native audio controls remain available before custom elements load and when JavaScript is unavailable.
