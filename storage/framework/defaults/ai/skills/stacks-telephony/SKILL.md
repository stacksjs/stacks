---
name: stacks-telephony
description: Use when implementing telephone numbers or voice calls - US/Canada number search and provisioning, Twilio call control, authenticated voice callbacks, TwiML responses, or bounded Media Streams audio. Covers @stacksjs/telephony.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Telephony

Read `storage/framework/core/telephony/README.md` for the public contracts and
provider limitations. Source is `storage/framework/core/telephony/src/`;
public API and isolated-consumer tests are in its `tests/` directory.

## Provider choice

`TwilioTelephony` is a real REST transport. Construction requires explicit
`accountSid`, `authToken`, and `journal`; `fetch` and `timeoutMs` are injectable.
Construction performs no network request. Credentials stay server-side.
`FakeTelephony` from `@stacksjs/telephony/testing` is deterministic and uses no
network. Its `receiveCall`, `setCallStatus` and `failNext` controls simulate
provider behavior without implying live delivery or provider approval.

Search with `searchNumbers({country: 'US' | 'CA', areaCode?, limit?})` and
provision only a country-verified result. A `+1` prefix alone is not a country
check. `provisionNumber` requires `phoneNumber` and an HTTPS `voiceUrl`;
regulatory `bundleSid`/`addressSid` are optional provider inputs, not approval.
`configureNumber` updates inbound routing; `releaseNumber` releases the number.
All provider writes incur real consequences when used with real credentials.
Use the application's authorized ownership, consent and spending checks first.

## Durable writes

Every write takes `{operationKey}`. Use the application's stable outbox/job ID,
scoped by workspace. `createCall`, `redirectCall`, `endCall`, `provisionNumber`,
`configureNumber`, and `releaseNumber` send a single request and never retry
behind the caller's back. The operation journal stores its fingerprint and
result. Different input with the same key fails. Pending and uncertain outcomes
block another attempt.

Implement the `OperationJournal` interface with an atomic durable unique-key
claim and durable settlement. A failed journal claim must prevent the provider
write. Never expire pending/uncertain entries into a fresh attempt: a process
may have crashed after Twilio committed. Reconcile through signed callbacks,
provider resources and audited operator review. Reusing a successful key
replays its result; a confirmed rejection is replayed without another request.
A newly authorized attempt after rejection uses a new key.

`MemoryOperationJournal` is bounded, local to one process, and suitable for
tests/development. It does not provide production outbox durability or
cross-process coordination. `getCall`, `listCalls` and `listNumbers` help
reconciliation, but lists are the first page (max 50) and can lag writes.
An empty call list is not proof an ambiguous call was never placed.

## Voice callback boundary

`parseVoiceWebhook({url, fields, signature, authToken, accountSid})` verifies
Twilio's HMAC-SHA1 signature over the exact configured public HTTPS URL and
all decoded form fields, before parsing. Preserve duplicates and whitespace;
apply a body-size limit before parsing the form. Never trust forwarded headers
to choose the public URL. JSON bodySHA256 callbacks are outside this helper's
contract. Check `CallSid` and destination ownership against the workspace.
Persist callback deduplication and ordering; signatures do not prove freshness.

Return `voiceResponse(steps)` as `text/xml` to answer an inbound call.
Supported steps: `say`, `dial`, `reject`, `hangup`, and bidirectional `stream`.
Speech and custom parameters are XML-escaped. Raw TwiML passed directly to a
call API must be trusted application code. Stream destinations use `wss:`
without query strings; put scoped non-secret context in custom parameters.

## Media Streams boundary

Authenticate the WebSocket upgrade with `verifyTwilioSignature` (empty form
fields, exact public HTTPS handshake URL) before accepting messages. Bind the
connection to a known account/call, then use `MediaStreamSession` to enforce
start metadata, stream identity, sequence progression and aggregate limits.
`parseMediaEvent` alone is a bounded parser, not authentication or a lifecycle.

Audio is raw mu-law, 8 kHz, mono. Default bounds are 64 KiB JSON, 8,000 bytes per
audio frame, and 30 minutes of audio per session. `mediaMessage` encodes bytes;
it does not transcode PCM or remove WAV headers. Mark acknowledgements can
mean completion or buffer clearing. `AudioQueue` rejects overflow explicitly
without dropping accepted frames. Apply socket backpressure and close/fail the
call on overflow; never silently drop or sample support audio.

These primitives do not supply a WebSocket host, STT, TTS, an AI orchestration
loop, consent policy or billing. Claim a live voice agent only after those
layers and real provider approval have been tested end to end.

## Completion evidence

From the package: `bun run build`, `bun test ./tests`, `bun run typecheck`.
From the repository: `./buddy lint storage/framework/core/telephony`.
The consumer test uses only copied manifest/dist output, no workspace aliases.
Keep provider access optional in CI and never purchase numbers or place calls
as an automatic test. Live acceptance is a separate explicitly authorized step.
