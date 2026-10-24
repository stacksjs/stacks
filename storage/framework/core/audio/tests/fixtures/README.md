`voice.m4a` is a synthetic 60-second mono tone, generated with FFmpeg 9.0.2:

```sh
ffmpeg -f lavfi -i 'sine=frequency=440:duration=60:sample_rate=16000' -ac 1 -c:a aac -b:a 32k voice.m4a
```

It deliberately keeps the MP4 index after the media, as phone recordings do.
Its media exceeds the input buffer, so a non-seekable decoder cannot silently
pass this regression with a tiny fixture. It contains no person's recording.
