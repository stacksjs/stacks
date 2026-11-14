# @stacksjs/telephony

Server-side Bun/TypeScript telephony with a real Twilio REST adapter, explicit write outcomes, authenticated voice callback parsing, escaped TwiML, and bounded Media Streams helpers. The `testing` entry contains a deterministic provider that never uses the network.

This package is a transport boundary. It does not provide a voice AI agent, speech recognition, text-to-speech, consent collection, billing, a WebSocket server or production provider approval. Tests use injected HTTP and the fake, not live numbers or calls.

## Provider and writes

```ts
import { TwilioTelephony, voiceResponse } from '@stacksjs/telephony'
import type { OperationJournal } from '@stacksjs/telephony'

// Supply a persistent implementation with an atomic unique-key claim.
declare const journal: OperationJournal
const telephony = new TwilioTelephony({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  journal,
})

const candidates = await telephony.searchNumbers({ country: 'CA', areaCode: '613', limit: 5 })
// These subsequent methods incur provider costs. Call only after application authorization.
const number = await telephony.provisionNumber({
  phoneNumber: candidates[0]!.phoneNumber,
  voiceUrl: 'https://app.example/provider/voice',
}, { operationKey: 'workspace:123:number:purchase:456' })

const call = await telephony.createCall({
  from: number.phoneNumber,
  to: '+16135550101',
  twiml: voiceResponse([{ type: 'say', text: 'Hello' }, { type: 'hangup' }]),
  statusCallback: 'https://app.example/provider/voice-status',
}, { operationKey: 'workspace:123:call:789' })
```

Search supports voice-capable US and Canadian **local** numbers. Search results determine the country; `+1` alone includes other NANP countries. The write APIs validate NANP E.164 syntax, not ownership or country. Provision only a country-verified search result, scope credentials/account resources to the correct workspace, and enforce authorization, consent, spend limits and regulatory requirements in the application. Optional `bundleSid` and `addressSid` are forwarded to Twilio; their presence does not imply approval.

Pass `timeLimitSeconds` to `createCall` to put a hard limit on the provider call,
including when the application worker goes away. `setCallTimeLimit(sid, seconds,
{operationKey})` updates that bound for an existing inbound/outbound call. Both
accept integer seconds from 1 to 86400; provider/account restrictions may be
stricter. Increasing a limit is a paid application decision: reserve its maximum
cost before changing the provider limit. Never rely on an in-process timer alone.

Call results expose `parentSid` for child-leg reconciliation, `durationSeconds`, `priceMicros`, `priceCurrency` and
`timeLimitSeconds`, null when the provider has not supplied them. `priceMicros`
is the nonnegative absolute provider charge at one million units per currency
unit, parsed from decimal strings without floating point. Currency is uppercase;
unknown price/currency must stay unreconciled, not be treated as free. The call
resource price may arrive after the completion callback and does not include
separate child legs, recordings, transcription, number rental or AI charges.
Aggregate the actual relevant resources in the application before settling.

`configureNumber(sid, voiceUrl, options)` changes inbound voice routing.
`configureSmsNumber(sid, smsUrl, options)` sets the HTTPS inbound SMS webhook
using POST without changing voice routing; it uses the same durable journal.
Number results expose voice/SMS application SIDs and the SIP trunk SID. Verify
these overrides are absent before claiming the webhook controls inbound routing,
because Twilio ignores the corresponding webhook when an application/trunk wins. `releaseNumber` releases a purchased number. `getCall`, `listCalls`, `redirectCall` and `endCall` retrieve or control calls. To answer an incoming call, return `voiceResponse(...)` as `text/xml` from the authenticated callback. Use `redirectCall` to change instructions for an existing call. `listNumbers(phoneNumber?)` and `listCalls({from?,to?})` return the first page, at most 50 results. Filter exact numbers when reconciling; eventual-consistency results cannot prove that an ambiguous outbound call was never created.

Each write requires a stable `operationKey` and a journal supplied at construction. Twilio Calls/IncomingPhoneNumbers are **not assumed** to implement an idempotency header. The adapter sends one request and never retries it automatically:

- A matching successful key replays the stored result. Different input with that key fails with `operation_conflict`.
- An in-flight key fails with `operation_pending`.
- Provider 4xx rejections are recorded and replayed without sending again; HTTP 408 remains uncertain.
- Transport errors, timeouts, 5xx, malformed success responses, or failure to persist a result produce `write_uncertain`. The key stays blocked.

Implement `OperationJournal.claim` as one durable atomic reservation keyed by `twilio:<accountSid>:<operationKey>`, storing its fingerprint and state. `settle` must atomically persist the outcome. Keep sensitive result data encrypted/scoped according to the application's retention policy. A process crash can leave `pending`; treat it as requiring reconciliation, never as an expired retry lease. Resolve pending/uncertain entries through an audited application reconciliation workflow using provider resources, callbacks and operator review. Do not rotate the key to bypass ambiguity. After a confirmed rejection, an explicitly authorized new attempt uses a new key.

`MemoryOperationJournal` is bounded (default 10,000 entries) and never evicts operations. It is for tests/development and offers no crash or multi-process durability. Production must supply a durable journal and outbox. The fake defaults to an isolated memory journal.

Requests use HTTPS Basic authentication, disabled redirects, a 10-second timeout (configurable to 120 seconds), and a 1 MiB response bound. Injected `fetch(url, init)` must honor `init.signal`. Errors expose fixed safe messages and typed `code`/HTTP status, never provider response text or transport error causes. No credentials are loaded implicitly and construction performs no network requests.

## Signed voice callbacks

```ts
import { parseVoiceWebhook, voiceResponse } from '@stacksjs/telephony'

const callback = parseVoiceWebhook({
  url: 'https://app.example/provider/voice', // Exact public URL, original query encoding/order included.
  fields: new URLSearchParams(rawFormBody),
  signature: request.headers.get('x-twilio-signature') ?? '',
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
})
// Bind callback.callSid / callback.to to the workspace before changing application state.
const xml = voiceResponse([{ type: 'say', text: 'Welcome to support' }])
```

Retain all decoded form fields and whitespace when verifying, including fields unknown to the application. Apply the route's body-size bound before allocating `rawFormBody`. `parseVoiceWebhook` verifies the signature and expected account, then validates required fields and sequence. `verifyTwilioSignature` also supports an empty field set for an authenticated WebSocket upgrade; pass the exact HTTPS handshake URL. This helper supports form callbacks and upgrades, **not JSON bodySHA256 callbacks**. Never derive the public URL from untrusted forwarded headers.

Twilio signatures do not include a freshness timestamp. Persist callback deduplication and order call updates by `CallSid` and sequence in the application. Signatures alone do not authorize workspace access or prevent replay. Check account/call ownership again at WebSocket start.

## Media Streams

`voiceResponse([{type: 'stream', url: 'wss://voice.example/media', parameters: {...}}])` emits bidirectional `<Connect><Stream>`. Stream URLs have no query string. Parameters and speech are XML-escaped. The safe TwiML vocabulary also includes `say`, `dial`, `reject` and `hangup`. Raw TwiML accepted by call APIs must be trusted application code.

`parseMediaEvent` parses connected/start/media/stop/mark/DTMF events with a 64 KiB JSON limit and 8,000-byte audio-frame limit by default. Audio is canonical base64, mu-law/8,000 Hz/mono. `MediaStreamSession({accountSid, callSid})` additionally enforces handshake order, exact sequence progression, matching stream/account/call, declared tracks and a default 30-minute aggregate audio bound. It retains metadata and counters, not audio history. Authenticate the WebSocket upgrade before creating the session and use the application's verified call binding.

`mediaMessage(streamSid, bytes)`, `markMediaMessage` and `clearMediaMessage` encode outgoing messages. Bytes must already be raw mu-law without WAV/MP3 headers; the helpers do not transcode or inspect the codec. Twilio mark acknowledgements can mean playback finished **or** the buffer was cleared.

`AudioQueue` copies frames and applies explicit byte/frame limits. Overflow throws `capacity` without dropping previously accepted audio. The application must implement backpressure or close/fail the call. Do not silently drop or sample support audio. Configure WebSocket frame limits and outbound `bufferedAmount`/acknowledgement gates at the server; these helpers cannot bound the provider's playback buffer or the server's socket buffers.

## Testing and validation

```ts
import { FakeTelephony } from '@stacksjs/telephony/testing'
const fake = new FakeTelephony()
// Same Telephony methods; no network and deterministic per-instance SIDs.
// receiveCall, setCallStatus and failNext are explicit simulation controls.
```

`failNext('before-request' | 'after-write' | 'rejected')` simulates loss before processing, a lost response after a successful mutation, or an HTTP rejection. The first mode is intentionally still uncertain to the adapter. The fake simulates basic caller ownership and terminal calls; it is not Twilio billing, regulation, timing or error-code parity.

From this package run `bun run build`, `bun test ./tests`, and `bun run typecheck`. From the repository run `./buddy lint storage/framework/core/telephony`. The isolated consumer test copies only the manifest and built output to a temporary `node_modules`, exercising both public exports with no repository aliases. Build before running tests.

Contracts follow [Twilio phone-number search](https://www.twilio.com/docs/phone-numbers/api/availablephonenumberlocal-resource), [provision/release](https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource), [call control](https://www.twilio.com/docs/voice/api/call-resource), [signature validation](https://www.twilio.com/docs/usage/security), [Stream TwiML](https://www.twilio.com/docs/voice/twiml/stream), and [Media Streams messages](https://www.twilio.com/docs/voice/media-streams/websocket-messages), reviewed November 13, 2026.

Live acceptance still requires authorized provider credentials, number/regulatory approval, a public HTTPS callback, signed WebSocket upgrade handling, and tested speech/AI integrations. No live provider calls or purchases are performed by the tests.
