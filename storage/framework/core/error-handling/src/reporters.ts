import type { ErrorReport, ErrorReportContext, ErrorReporter } from '@stacksjs/types'
import process from 'node:process'

const registered: ErrorReporter[] = []
const reported = new WeakSet<Error>()
const broken = new WeakSet<ErrorReporter>()
const configuredSeen = new Set<unknown>()
const CONFIG_OVERRIDES_KEY = Symbol.for('@stacksjs/config:overrides')

function attachConfiguredReporters(): void {
  const overrides = (globalThis as Record<symbol, unknown>)[CONFIG_OVERRIDES_KEY] as {
    monitoring?: { reporters?: unknown }
  } | undefined
  const configured = overrides?.monitoring?.reporters
  if (!Array.isArray(configured))
    return

  for (const reporter of configured) {
    if (configuredSeen.has(reporter))
      continue
    configuredSeen.add(reporter)
    if (!registered.includes(reporter as ErrorReporter))
      registerErrorReporter(reporter as ErrorReporter)
  }
}

function asError(value: unknown): Error {
  if (value instanceof Error)
    return value
  if (typeof value === 'string')
    return new Error(value)

  try {
    return new Error(JSON.stringify(value))
  }
  catch {
    return new Error(String(value))
  }
}

/** Attach a reporter and return a function that detaches it. */
export function registerErrorReporter(reporter: ErrorReporter): () => void {
  if (!reporter || typeof reporter.name !== 'string' || !reporter.name || typeof reporter.report !== 'function') {
    process.stderr.write('[error-reporting] Ignoring a reporter without a name and report() function.\n')
    return () => {}
  }

  registered.push(reporter)
  return () => {
    const at = registered.indexOf(reporter)
    if (at !== -1)
      registered.splice(at, 1)
  }
}

/** A copy of the reporters attached to this process. */
export function reporters(): readonly ErrorReporter[] {
  attachConfiguredReporters()
  return [...registered]
}

/**
 * Deliver one exception without ever throwing back onto its handling path.
 *
 * Error identity is the deduplication key. The same exception may pass through
 * an action boundary, the router boundary, and a process boundary, but it is
 * still one failure and each reporter receives it once.
 */
export function captureError(value: unknown, context?: ErrorReportContext): Error {
  attachConfiguredReporters()
  const error = asError(value)
  if (registered.length === 0 || reported.has(error))
    return error

  reported.add(error)
  const event: ErrorReport = { error, ...(context ? { context } : {}) }

  for (const reporter of registered) {
    try {
      reporter.report(event)
    }
    catch (cause) {
      if (broken.has(reporter))
        continue
      broken.add(reporter)
      const reason = cause instanceof Error ? cause.message : String(cause)
      process.stderr.write(`[error-reporting] Reporter "${reporter.name}" threw: ${reason}. Further throws from it are silent.\n`)
    }
  }

  return error
}

/** Drain every buffering reporter without turning shutdown into a failure. */
export async function flushErrorReporters(): Promise<void> {
  attachConfiguredReporters()
  const pending = registered
    .filter(reporter => typeof reporter.flush === 'function')
    .map(reporter => Promise.resolve().then(() => reporter.flush!()))

  if (pending.length > 0)
    await Promise.allSettled(pending)
}
