---
name: stacks-video
description: Use when planning or processing native video renditions, HLS/DASH delivery, preview tracks, signed assets, or file/range responses. Covers @stacksjs/video and actual runtime codec capabilities.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Native video planning and delivery

video(source) builds a source-profile and runtime-capability-aware plan. Use
inspectVideo where appropriate, then actual encoder/codec capabilities rather
than assuming a host can transcode every output named in a type.

## Plan, process, and serve

deriveVideoLadder and the builder generate rendition/copy/transcode decisions.
assertVideoPlanExecutable rejects unavailable paths. processVideoPlan delegates
work to the installed delivery pipeline and returns actual derivatives/files.
A successful plan alone is not a rendered MP4, WebM, HLS or DASH asset.

createHlsMaster and createPreviewVtt build delivery manifests/tracks.
createProtectedVideoPlaylist, signVideoAsset and verifyVideoAsset support
protected delivery with separately authorized key access. Use videoFileResponse,
parseByteRange and the content/cache header helpers for the file-serving contract;
do not implement a second ad-hoc range parser around the same assets.

## One web MP4 and a poster, with ffmpeg

ts-videos cannot encode in Bun (no WebCodecs or OffscreenCanvas), so
`transcodeForWeb(input, output, options)` and `posterFrame(input, output,
options)` encode with ffmpeg. Use them to turn any upload, typically an iPhone
HEVC .MOV with HLG or Dolby Vision HDR and a rotation matrix, into one H.264
High@4.0 MP4 (yuv420p, BT.709, AAC 128k stereo 48 kHz, `+faststart`) plus a
JPEG poster:

- fits inside 1280x720, or 720x1280 for portrait (`maxBox`), never upscaled,
  even sides; resampled to `fps` (30) only when the source is above it;
- rotation applied to the frames, so no display matrix in the output;
- HDR (PQ, HLG, Dolby Vision, detected by `probeVideo` through ffprobe)
  tone-mapped to SDR with swscale colour management on ffmpeg 8 and later, else
  zscale and tonemap, and refused when the build has neither;
- every piece of metadata stripped, the GPS `location` atom included; every
  upload is re-encoded, an H.264 MP4 too.

ffmpeg and ffprobe come from the `ffmpeg`/`ffprobe` options, then
`VIDEO_FFMPEG`/`VIDEO_FFPROBE`, then PATH. Both run under `nice` (default 10)
in their own process group, killed on `timeoutMs`; output is written to a
`.partial` file and renamed when complete. The returned width, height,
duration and bytes are measured from the file written. `webTranscodeArgs` and
`colourFilters` expose the exact arguments. Tests: web.test.ts, with
fixtures/hlg-portrait.mov (made by make-hlg-portrait.sh); the encoding tests
skip with a warning when ffmpeg is absent, and `STACKS_REQUIRE_FFMPEG=1` makes
that a failure.

Storage, source inspection, source paths, cache behavior and streaming need
verification for the actual deployment target. Processing tests mock the native
pipeline; they do not certify live encoding support on an arbitrary machine.
Test invalid ranges, signatures/expiry, capabilities and file metadata.
Source: core/video/src/index.ts, files.ts, inspect.ts and web.ts. Retained
tests: video.test.ts, process.test.ts, files.test.ts and web.test.ts.
