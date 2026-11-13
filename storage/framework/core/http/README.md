# Stacks HTTP

`@stacksjs/http` provides HTTP status constants, bounded outbound requests and
transfer observations. It runs on Bun.

## Requests and budgets

```ts
import { Response as HttpStatus, fetchWithBudget } from '@stacksjs/http'

const response = await fetchWithBudget('https://example.com/status', {
  timeoutMs: 5000,
  retry: 2,
})
if (response.status === HttpStatus.HTTP_OK)
  console.log(await response.text())
```

`Response` is the status enum. `fetchWithBudget` returns the real Fetch Response;
non-success status codes remain responses. One deadline covers request attempts
and retry waits. The helper retries 429/503, honors numeric or HTTP-date
Retry-After, and cancels discarded bodies. A delay longer than the remaining
budget ends at the deadline. Streaming uploads and Requests with bodies are
sent once because they cannot be replayed safely.

The deadline ends when final response headers arrive. The caller owns the
subsequent body read, its cancellation/inactivity/total budget, verification and
publication. An incoming AbortSignal is composed with the request deadline.

## Observe attempts and response metadata

Pass `observer.onAttempt` and/or `observer.onResponse` in the request options.
Callbacks retain their observer receiver. Attempt notifications precede each
actual fetch; response notifications precede its retry decision. Fetch follows
redirects, so a response observation describes the selected final response, not
an intermediate redirect history.

Observations are immutable. They include a one-based attempt number and HTTP(S)
origins; response observations also include status and optional Content-Length.
URL credentials, paths, queries, fragments, arbitrary headers and bodies are
excluded. URL input above 4096 UTF-16 code units or an origin above 512 is omitted
with an `originOmitted` reason. Invalid and unsupported origins are also omitted.
Content-Length must fit a nonnegative safe integer, with at most 16 decimal
digits in a header of at most 32 code units; otherwise it is null.

Callbacks are never awaited. Synchronous exceptions, throwing callback getters
and rejected promises are isolated without logging their contents. Callbacks
must return promptly; synchronous work they perform still runs on the caller's
thread. Observation adds no request, timer, body reader, wrapper or tee.

## Record the bytes your caller reads

```ts
import { createHttpTransferObservation, fetchWithBudget } from '@stacksjs/http'

const observation = createHttpTransferObservation()
const response = await fetchWithBudget('https://example.com/archive', {
  timeoutMs: 5000,
  observer: observation.observer,
})
if (!response.body)
  throw new Error('The response has no readable body')

const reader = response.body.getReader()
try {
  for (;;) {
    const chunk = await reader.read()
    if (chunk.done)
      break
    if (chunk.value.byteLength)
      observation.received(chunk.value.byteLength)
    // The caller consumes or verifies the same bytes here.
  }
}
catch (error) {
  console.error(observation.finish('unknown'))
  throw error
}
finally {
  await reader.cancel().catch(() => {})
  reader.releaseLock()
}
console.log(observation.finish('complete'))
```

This example does not add a body deadline. A downloader must keep its own shared
deadline/inactivity signal active through body consumption and preserve its
existing retry, integrity and publication rules. Choose the terminal reason from
that caller's actual outcome: `complete`, `total-deadline`, `idle`, `transport`,
`http-status`, `checksum` or `unknown`. The collector does not infer a failure
cause from a status or arbitrary error message.

The report contains the latest copied attempt/response metadata, byte/chunk
totals, header/first-byte/last-byte elapsed times, terminal elapsed time,
last-byte age and maximum gap between nonempty chunks. Before any bytes arrive,
byte timestamps and last-byte age are null.

Retention is fixed at 12 ten-second buckets. Bytes at or after 120000 ms merge
into the last bucket, whose `throughMs` records the actual last observation;
`coalesced` becomes true. This retention boundary creates no transfer deadline.
There is no configurable clock, interval, bucket count or history size.

Feed positive safe-integer byte lengths. Invalid counts or metadata are ignored
and set `invalidObservation`. Counters saturate at Number.MAX_SAFE_INTEGER with
`overflowed`; invalid/backward clock samples keep the previous finite elapsed
time. `finish` returns one deeply frozen report. Repeated finishes return the
same object and later observations have no effect.

These are caller-supplied observations. The collector does not independently
measure socket traffic, enforce a byte limit, hash content or publish files.

## Evidence and limits

`tests/fetch-budget.test.ts` uses real loopback HTTP for redirect metadata,
receiver/error isolation, URL/Content-Length boundaries, retry chronology,
cancellation, request budgets and intact caller-owned bodies.
`tests/transfer-observation.test.ts` covers real caller-read bytes plus supplied
counter boundaries, immutable/idempotent reports and metadata privacy. Its
worked monotonic timelines use an external clock spy and restore it in finally;
they establish aggregation behavior, not network latency or remote throughput.

These tests do not establish a provider SLA, a remote download cause, an
application's body-timeout policy or acceptance of a published package. Validate
public declarations and the actual consumer when releasing changes.

Run this package's suite from its directory with `bun test ./tests`.

## License

MIT. See the repository [license](https://github.com/stacksjs/stacks/blob/main/LICENSE.md).
