# Stacks Testing

wip

## Owned test services


Import `startTestService` and `notifyTestServiceReady` from
`@stacksjs/testing/service` in CLI scripts, without loading the test runner or
database. The child calls `notifyTestServiceReady(info)` only after its own
application checks succeed. Listening on a port is insufficient. The function
returns false when the script was started manually without IPC.

The parent awaits `service.ready`, then combines `service.signal` with its
command deadline using `AbortSignal.any`. Unexpected child exit aborts that
signal and rejects readiness if still pending. `service.exited` reports its
status. Always await `service.stop()` in finally: cleanup is idempotent and
disposes the owned command and its inherited descendants. POSIX sends SIGTERM
then SIGKILL after `stopGraceMs` (default 2 seconds); Windows uses an inherited
Job Object with native termination and zero-member confirmation. `service.pid`
identifies the stable lifecycle owner. Readiness is forwarded from the actual
command over its own IPC channel.
Readiness has a separate `startupTimeoutMs` (default 60 seconds).

## Isolated fixture ownership

`runIsolated` from `@stacksjs/testing/isolated` uses the same native ownership
primitive. A normal early command exit also disposes its remaining descendants
before returning the command status and captured output. The timeout remains a
failed timeout even when the command handles termination and exits zero.

Ownership is established before command startup. POSIX process groups retain a
controlled owner until disposal; Windows Job Objects are assigned before that
owner permits the command to run. Cleanup does not enumerate or guess process
IDs and does not target unrelated processes. Deliberate POSIX `setsid` or
breakaway children are outside this lifecycle contract, which is not a sandbox.
Native ownership failures reject rather than fall back to direct-child cleanup.

## Browser readiness and speculative requests

`@stacksjs/testing/browser` retains every finite request in `cdp.inFlight`.
`cdp.foregroundInFlight` excludes only Chrome's `Prefetch` requests or requests
whose `Purpose` / `Sec-Purpose` header declares `prefetch`. Event streams leave
both views when their response starts.

`settle`, `navigate` and `auditPage` include speculative work by default. Pass
`includeSpeculative: false` to wait for the current document's foreground work
while background prefetches remain observable. This changes only readiness:
HTTP failures, duplicate API calls, console errors and runtime failures still
appear in audits and can fail `pageAuditClean`.

## Trusted browser clicks

`click` from `@stacksjs/testing/browser` resolves a unique selector (optionally
with exact text), scrolls it into view, and waits for stable geometry and an
enabled, unobscured target. It uses Chrome's trusted input path and checks the
target again as the pointer and mouse events arrive. A layout change or DOM
replacement between measurement and delivery cannot silently click a different
control.

A wholly suppressed gesture can resolve the target again within the original
action deadline (12 seconds by default). Once any input has reached the target,
a later target change fails the action rather than replaying it. Transport
failures also fail without retrying an action whose effects are uncertain.
Accepted clicks retain normal descendant, label, focus and navigation behavior.

## ☘️ Features

wip

- ⚡️

wip

## 🤖 Usage

wip

```bash
bun install -d @stacksjs/testing
```

Now, you can use it in your project:

```js
import { tests } from '@stacksjs/testing'

// wip
```

Learn more in the docs.

## 🧪 Testing

```bash
bun test
```

## Clock control in standalone fixtures

Bun scripts outside the test runner can import clock controls without loading
lifecycle hooks:

```ts
import { freezeTime, travelTo, useRealTime } from '@stacksjs/testing/time'

try {
  freezeTime('2026-01-15T10:00:00Z')
  travelTo('2026-01-16T10:00:00Z')
}
finally {
  useRealTime()
}
```

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://stacksjs.com/discord)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙

A short-lived service must flush readiness before exiting. The optional
`notifyTestServiceReady(info, sent)` callback reports completion of the IPC write;
wait for it before `process.exit()`. The boolean return still indicates whether
an owning IPC channel exists. An enqueued notification alone does not establish
that it reached the owner before immediate process termination.
