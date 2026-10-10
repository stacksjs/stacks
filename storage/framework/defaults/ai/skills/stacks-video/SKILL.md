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

Storage, source inspection, source paths, cache behavior and streaming need
verification for the actual deployment target. Processing tests mock the native
pipeline; they do not certify live encoding support on an arbitrary machine.
Test invalid ranges, signatures/expiry, capabilities and file metadata.
Source: core/video/src/index.ts, files.ts and inspect.ts. Retained tests:
video.test.ts, process.test.ts and files.test.ts.
