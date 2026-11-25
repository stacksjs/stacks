`voice.m4a` is a synthetic 60-second mono tone, generated with FFmpeg 9.0.2:

```sh
ffmpeg -f lavfi -i 'sine=frequency=440:duration=60:sample_rate=16000' -ac 1 -c:a aac -b:a 32k voice.m4a
```

It deliberately keeps the MP4 index after the media, as phone recordings do.
Its media exceeds the input buffer, so a non-seekable decoder cannot silently
pass this regression with a tiny fixture. It contains no person's recording.

`voice-aac-lc.m4a`, `voice-opus-silk.opus` and `voice-opus-celt.webm` are the
same synthesised sentence, "Knee is fine.", about 0.83 seconds long, in the three
shapes voice notes reach the server: AAC-LC in M4A (the phone app and Safari),
SILK Opus in Ogg (WhatsApp and Firefox) and CELT Opus in WebM (Chrome). They are
copied from ts-videos (`packages/ts-videos/test/fixtures/voice/`), which made
them with macOS's speech synthesiser and Apple's encoders, without FFmpeg; its
`make-voice-fixtures.sh` and `make-opus-fixtures.ts` rebuild them. They contain
no person's recording.

`voice-mp3-mono.mp3` and `voice-mp3-vbr.mp3` are that sentence as MP3 at 44.1
kHz, the form a voice note takes when it is exported or shared as a file: 64
kbit/s constant bitrate starting on a frame, and variable bitrate behind ID3v2
and ID3v1 tags. They are copied from the same ts-videos folder (as of 0.3.2),
which encoded the synthesiser's output with LAME, without FFmpeg; its
`make-mp3-fixtures.ts` rebuilds them. They contain no person's recording.
