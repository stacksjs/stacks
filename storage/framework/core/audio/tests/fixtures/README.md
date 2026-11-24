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
