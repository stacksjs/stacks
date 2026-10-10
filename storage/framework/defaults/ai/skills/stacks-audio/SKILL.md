---
name: stacks-audio
description: Use when planning native audio derivatives, processing supported audio formats, generating waveforms/transcripts, or signing audio delivery. Covers @stacksjs/audio and runtime encoder capability checks.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Native audio planning and delivery

audio(source) builds a profile-driven delivery plan. Supply an inspected
AudioProfile and actual runtime encoder/codec capabilities. A declared output
does not prove that an encoder is available.

## Plan versus process

generate() returns the plan, including copy/transcode actions and availability.
assertAudioPlanExecutable rejects an unavailable encoding path. process() or
processAudioPlan delegates executable work to the installed native-transcode
implementation. Do not report a generated plan as finished media bytes.

Content type, format and source characteristics determine bitrate/output
selection. negotiateAudioOutput handles accept preferences. createWaveform and
normalizeTranscript build waveform data and transcript/VTT output from supplied
samples/segments; they do not infer spoken text from an audio file themselves.

audioResponseHeaders supports delivery caching; signAudioAsset/verifyAudioAsset
and createProtectedAudioPlaylist support protected delivery. Preserve expiration,
path and key handling; a protected playlist still needs an authorized key route.

Tests prove planning, capability rejection, helpers and delegated processing.
The processing test mocks the transcoder, so it is not evidence that every codec
works on every host. Verify the real target runtime when producing assets.
Source: core/audio/src/index.ts. Evidence: audio.test.ts and process.test.ts.
