---
name: stacks-error-handling
description: Use when implementing error handling in Stacks - the Result type (Ok/Err), handleError function, error page rendering (development with stack traces, production with friendly messages), ErrorHandler class, ModelNotFoundException, HTTP error mapping, log file writing, or error configuration. Covers @stacksjs/error-handling and config/errors.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Error Handling

Use Result for recoverable operation outcomes, HttpError for HTTP boundary
refusals, and the native reporter/rendering pipeline for failures.

## Results

~~~ts
import { ok, err, fromPromise } from '@stacksjs/error-handling'

const result = await fromPromise(Promise.resolve('ready'))
if (result.isOk)
  console.log(result.value)
else
  console.error(result.error)
~~~

ok(value)/err(error), Result/Ok/Err and ResultAsync are re-exported from
ts-error-handling. isOk/isErr are discriminant properties, not methods.
fromPromise returns a Promise<Result>; await it before narrowing. Returning an
Err does not throw, and an awaited Result does not imply success.

## HTTP errors and rendering

~~~ts
import { HttpError, renderHttpError } from '@stacksjs/error-handling'

const error = new HttpError(422, 'Validation failed', { errors: { email: ['Required'] } })
const response = await renderHttpError(error, undefined, { status: 422, isDevelopment: false })
~~~

renderHttpError returns a Response and accepts optional request/options.
createHttpErrorHandler offers setRequest/setRouting/addQuery and status helpers.
The lower-level renderErrorPage(error, status?, config?) and renderError(error,
status?) are async HTML renderers. renderProductionErrorPage(status) is the
synchronous production HTML renderer, not a function taking error/request.
errorResponse(error, status?, config?) returns Promise<Response>.

createErrorHandler(config?) returns the ErrorPageHandler builder; set request,
routing/user/framework context on it, then await render/handleError. Explicitly
resolve development mode for a public entrypoint rather than assuming an env
alias's default will protect details. Production pages omit source/trace detail;
custom error pages and illustration selection use the renderer's own contracts.

HTTP_ERRORS is status metadata; exported HttpErrorInfo is its interface, distinct
from the throwable HttpError class. ModelNotFoundException is the ORM failure
type. isUniqueViolation recognizes provider uniqueness errors; map a business
conflict deliberately rather than returning raw provider text.

## Handling, reporting and shutdown

handleError(value, options?) returns an Error synchronously and schedules logging.
ErrorHandler.handle preserves an existing Error's trace/cause when possible.
writeErrorToFile is async; writeErrorToConsole is sync. shouldExit is a process
policy, not appropriate inside a request action. A background file write cannot
be assumed finished before process.exit.

writeToLogFile(message, { logFile? }) uses a file path; setLogPath changes its
fallback. config/errors.ts holds validation messages, not all operational logging
or monitoring configuration. An Error model definition does not itself persist
every exception to its table.

registerErrorReporter(reporter) returns a detach function; reporters() snapshots
registered/configured reporters. captureError(error, context?) isolates reporter
failure and deduplicates by Error object identity, not message text.
flushErrorReporters drains buffers. Configured monitoring reporters and BugHQ
use the shared environment gate; see stacks-env and config/monitoring.ts.
The logging report() chokepoint filters ordinary 4xx from incident reporting.

## Evidence

Source: `storage/framework/core/error-handling/src/index.ts`, handler.ts,
http.ts, error-page.ts, reporters.ts, bughq.ts and unique-violation.ts.
Tests: result-type.test.ts, http-errors.test.ts, error-page-render.test.ts,
custom-error-pages.test.ts and reporters.test.ts under core/error-handling/tests.
Keep error payloads and credentials out of public responses and diagnostics.
