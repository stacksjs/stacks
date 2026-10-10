---
name: stacks-logging
description: Use when implementing logging in Stacks - the log facade (info, error, warn, debug, success), dump/dd debugging, timing functions, file-based logging, or log configuration. Covers @stacksjs/logging and config/logging.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Logging

Use the native log facade, request context and transports. Console output,
local files, remote log shipping and exception reporting are separate sinks.

## Calls and context

~~~ts
import { log, withLogContext } from '@stacksjs/logging'

await withLogContext({ requestId: 'request-7', userId: 7 }, async () => {
  await log.info('Order created', { orderId: 42 })
})
~~~

info/debug accept multiple arguments; success accepts a message; warn(message,
context?) and warning(message) are aliases with different signatures.
Prefer log.error(message, error?, context?) so Error name/message/stack/cause
are retained. withLogContext uses an async scope; getLogContext reads it.
Do not hold one user's context in a global object for later requests.

log.time(label) returns an async completion callback accepting optional metadata.
logger() is an async function returning the underlying clarity Logger, not an
exported instance. dump/dd/echo are async inspection helpers; dd exits after
inspection and does not belong in a serving request path.

## Shutdown and synchronous paths

Ordinary log methods return promises. struct.request/query/slowQuery/job and
other structured helpers queue tracked writes and return void. Use log.flush()
before an explicit exit to drain writes, transport buffers and error reporters.
The native beforeExit hook drains once on natural shutdown; process.exit bypasses
that opportunity. log.exit(message?, code?) flushes before exiting.

syncWarn/syncError write synchronously; fatal(message, code?) synchronously
prints and exits. Legacy shouldExit error options remain compatibility behavior;
use the explicit exit API for a CLI and return/throw from an HTTP action instead.

## Levels, formats and destinations

Effective settings resolve env override, then config, then framework default.
parseLogLevel/currentLevel use debug/info/success/warning/error (warn aliases
warning). LOG_FORMAT chooses text/json; resolveLogSettings supports configured
format/file-writing options. Read config/logging.ts rather than inventing a
separate severity vocabulary from another logger.

Default local logs live under storage/logs; selected file paths and runtime
fallbacks come from the logger/config. The Log model does not automatically make
every log call a database insert. normalizeError/normalizeContext retain embedded
Error detail and bound cause traversal; they are not secret redaction policies.

registerTransport(transport) returns a detach function; transports() returns a
copy. A LogTransport has name, log(record), optional level and flush(). log must
return immediately; buffer external I/O and drain it through flush. Records retain
args and scoped context before formatting. Transport exceptions are contained
and reported once, so logging a failure does not throw a second one at the caller.

LogHQ transport is exported from `@stacksjs/logging/loghq`. config/logging.ts
uses LOGHQ_KEY/project/baseUrl and initializeIntegration; the shared environment
gate normally allows production/staging. Credentials alone do not justify sending
local or CI telemetry. BugHQ reporters are a separate error-reporting sink.

report(error, options?) is the framework exception chokepoint: ordinary 4xx are
debug diagnostics; server failures reach captureError and log.error. Duplicate
Error identity is deduplicated at the reporter layer. See stacks-error-handling.

## Source and verification

Public narrow runtime: `@stacksjs/logging/runtime`. Implementation:
`storage/framework/core/logging/src/index.ts` and loghq.ts.
Tests under core/logging/tests: trace-context.test.ts, transports.test.ts,
level-filtering.test.ts, context-normalization.test.ts, beforeexit-drain.test.ts,
exit-flushes.test.ts and loghq.test.ts.
