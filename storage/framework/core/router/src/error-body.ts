/**
 * The one JSON error shape every Stacks HTTP answer uses:
 * `{ error, message, status, timestamp, details? }` (stacksjs/stacks#3361).
 *
 * The router's error handler always wrote it. Two other answers did not: a
 * direct native route that failed without an error handler sent
 * `{ success, message, error }` with the raw `error.message`, and the desktop
 * agent sent `{ error: message }`. A client had to read three shapes, and
 * two of them told it the cause of a server error.
 *
 * Pure, with no imports, so code that must stay light (the desktop agent)
 * can use it.
 */

export interface ErrorResponseBody {
  /** The kind of error: an HTTP reason phrase or an error's name. */
  error: string
  /** What to tell the caller. Never the cause of a 5xx. */
  message: string
  status: number
  timestamp: string
  details?: Record<string, unknown>
}

export interface ErrorBodyOptions {
  error: string
  message: string
  status: number
  details?: Record<string, unknown>
}

/** An error answer's body, in the standard shape. */
export function errorBody(options: ErrorBodyOptions): ErrorResponseBody {
  const body: ErrorResponseBody = {
    error: options.error,
    message: options.message,
    status: options.status,
    timestamp: new Date().toISOString(),
  }
  if (options.details)
    body.details = options.details
  return body
}

/** The body of a 500: it names no cause, which belongs in the log. */
export function internalServerErrorBody(): ErrorResponseBody {
  return errorBody({ error: 'Internal Server Error', message: 'An unexpected error occurred.', status: 500 })
}
