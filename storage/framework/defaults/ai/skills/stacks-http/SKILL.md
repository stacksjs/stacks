---
name: stacks-http
description: Use when choosing HTTP status constants, bounded fetch, outbound Httx requests, transport fakes, retry/circuit behavior, or the boundary with reactive browser fetching. Covers @stacksjs/http and @stacksjs/httx.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks HTTP

Use the native HTTP status constants and bounded fetch helper for outbound
requests. Use stacks-api/stacks-router for inbound routes and the typed client;
stacks-composables owns reactive browser fetching.

## Native package

~~~ts
import { Response as HttpStatus, fetchWithBudget } from '@stacksjs/http'

const response = await fetchWithBudget('https://api.example.com/status', {
  timeoutMs: 5000,
  retry: 2,
})
if (response.status === HttpStatus.HTTP_OK)
  console.log(await response.json())
~~~

Response is a status-code enum, not the Fetch API Response constructor. Alias
it when both are used. fetchWithBudget returns the real Fetch Response;
non-2xx status is a response, not automatically an exception.

The current helper adds an abort timer per fetch attempt (default 30 seconds),
and retries 429/503 up to retry (default zero). Numeric Retry-After seconds or
exponential delay is capped at 30 seconds between attempts. It does not parse
HTTP-date Retry-After, impose one total deadline including all retries, or keep
the timer active while the caller later streams the body. It supplies its own
AbortController signal rather than composing an incoming signal. Check these
bounds before depending on it for a whole multi-step provider operation.

## Httx client and fluent requests

The separate `@stacksjs/httx` dependency exports HttxClient, the httx facade,
http/PendingRequest, typed errors, fake requests and circuit-breaker helpers.
Use the installed public declarations instead of copying a cached option list.

~~~ts
import { HttxClient } from '@stacksjs/httx'

const client = new HttxClient({ timeout: 5000 })
const result = await client.request('https://api.example.com/users', { method: 'GET' })
if (result.isOk)
  console.log(result.value.status, result.value.data)
else
  console.error(result.error)
~~~

The Result discriminator is a boolean property, not isOk(). fromPromise and
request return promises of Results; await before inspecting them. Httx responses
include status/statusText/headers/data/timings. The fluent http() chain supports
headers/tokens/basic-auth, query parameters, JSON/form/multipart, timeout and
retry before the verb. Configuration also has a request-complete hook and a
circuit-breaker option; consult their exact current type before integrating.

httx.fake/sequence/recorded/assertSent/assertSentCount/assertNothingSent support
deterministic transport tests. restoreFetch in teardown: fake state is shared
within the dependency's process. A retry of a non-idempotent write still needs
the provider's idempotency mechanism.

## Browser requests

Read stacks-composables for useFetch/createFetch/useQuery/useMutation and the
actual STX runtime globals. That contract changes independently from httx.
Import helpers explicitly in a TypeScript module; a manifest declaration alone
does not inject a browser binding. Cookie writes need the native CSRF/request
flow in stacks-browser, not an ad hoc fetch that forgets credentials or headers.

## CLI and evidence

buddy http makes an outbound diagnostic request; use its help for options.
Source: `storage/framework/core/http/src/index.ts` and
`core/buddy/src/commands/http.ts`. Httx's public contract is the installed
dependency's package exports/declarations. Retained local status/helper tests
are in `core/http/tests/http.test.ts`; they do not prove a remote provider SLA.
