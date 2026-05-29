/* eslint no-console: 0 */
import { AsyncLocalStorage } from 'node:async_hooks'
import process from 'node:process'
import { Logger } from '@stacksjs/clarity'
import { handleError } from '@stacksjs/error-handling'
import { ExitCode } from '@stacksjs/types'

// Lazy logger initialization to avoid circular dependency with path
let _logger: Logger | null = null
let _loggerInitPromise: Promise<void> | null = null

// In-flight async writes (stacksjs/stacks#1934). The fire-and-forget
// `log.struct.*` helpers used to `void` their promise, so a write
// kicked off right before shutdown could be lost — and `log.flush()`
// had no way to see it. Track every async write here so `flush()` can
// drain them, and register a `beforeExit` flush so a natural shutdown
// doesn't truncate buffered output.
const pendingWrites = new Set<Promise<unknown>>()

function track<T>(p: Promise<T>): Promise<T> {
  pendingWrites.add(p)
  // Always detach on settle so the set doesn't grow unbounded.
  p.finally(() => pendingWrites.delete(p)).catch(() => {})
  return p
}

let _flushOnExitRegistered = false
function registerFlushOnExit(): void {
  if (_flushOnExitRegistered) return
  _flushOnExitRegistered = true
  // `beforeExit` fires when the event loop empties (a natural exit),
  // and unlike `process.exit()` it can run async work. We drain there.
  // The explicit-`process.exit` race is intentionally NOT covered here
  // — that's what the sync escape hatches (`log.syncError`/`log.fatal`)
  // are for; see their docs.
  process.on('beforeExit', () => {
    void log.flush()
  })
}

// Request context propagation for structured logging
export interface LogContext {
  requestId?: string
  userId?: string | number
  [key: string]: unknown
}

/** Valid log levels — mirrors `@stacksjs/clarity`'s `LogLevel`. */
export type LogLevel = 'debug' | 'info' | 'success' | 'warning' | 'error'
export type LogFormat = 'json' | 'text'

const VALID_LEVELS: ReadonlySet<string> = new Set<LogLevel>(['debug', 'info', 'success', 'warning', 'error'])

/**
 * Parse + validate `LOG_LEVEL` (stacksjs/stacks#1932). Previously the
 * env value was cast `as any` straight into the logger, so a typo
 * (`LOG_LEVEL=infoo`) silently produced undefined behavior. Now an
 * unknown value warns once and falls back. Accepts `warn` as an alias
 * for clarity's `warning`.
 */
export function parseLogLevel(raw: string | undefined, fallback: LogLevel = 'info'): LogLevel {
  if (!raw) return fallback
  const v = raw.toLowerCase()
  if (v === 'warn') return 'warning'
  if (VALID_LEVELS.has(v)) return v as LogLevel
  process.stderr.write(`[logging] Ignoring invalid LOG_LEVEL="${raw}" (expected: ${[...VALID_LEVELS].join(', ')}); using "${fallback}".\n`)
  return fallback
}

/** Parse + validate `LOG_FORMAT`; defaults to json in prod, text in dev. */
export function parseLogFormat(raw: string | undefined): LogFormat {
  if (raw === 'json' || raw === 'text') return raw
  if (raw)
    process.stderr.write(`[logging] Ignoring invalid LOG_FORMAT="${raw}" (expected "json" or "text").\n`)
  return process.env.NODE_ENV === 'production' ? 'json' : 'text'
}

export interface ResolvedLogSettings {
  level: LogLevel
  format: LogFormat
  writeToFile: boolean
}

/**
 * Resolve the effective logger settings with precedence
 * **env var > config file > default** (stacksjs/stacks#1935). Pure +
 * exported so the precedence is unit-testable without booting the
 * singleton logger.
 */
export function resolveLogSettings(input: {
  envLevel?: string
  envFormat?: string
  cfgLevel?: string
  cfgFormat?: string
  cfgWriteToFile?: boolean
  isProduction?: boolean
}): ResolvedLogSettings {
  const level: LogLevel = input.envLevel
    ? parseLogLevel(input.envLevel)
    : (input.cfgLevel ? parseLogLevel(input.cfgLevel) : 'info')

  const format: LogFormat = input.envFormat
    ? parseLogFormat(input.envFormat)
    : (input.cfgFormat === 'json' || input.cfgFormat === 'text'
        ? input.cfgFormat
        : (input.isProduction ? 'json' : 'text'))

  return { level, format, writeToFile: input.cfgWriteToFile ?? true }
}

/**
 * Normalize any thrown value into a stable, serializable shape
 * (stacksjs/stacks#1932). `JSON.stringify(new Error())` yields `{}`,
 * dropping the stack/message — so historically `log.error('x', err)`
 * lost the error entirely. This walks `.cause` (bounded) and always
 * captures name/message/stack.
 */
export interface NormalizedError {
  name: string
  message: string
  stack?: string
  cause?: NormalizedError
}

export function normalizeError(err: unknown, depth = 0): NormalizedError {
  if (depth > 8)
    return { name: 'Error', message: '[cause chain truncated]' }
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      cause: err.cause != null ? normalizeError(err.cause, depth + 1) : undefined,
    }
  }
  if (typeof err === 'string')
    return { name: 'Error', message: err }
  if (err == null)
    return { name: 'Error', message: String(err) }
  try {
    return { name: 'Error', message: JSON.stringify(err) }
  }
  catch {
    return { name: 'Error', message: String(err) }
  }
}

/** Render a normalized error (+ its cause chain) to a printable string. */
export function renderNormalizedError(n: NormalizedError): string {
  let out = n.stack || `${n.name}: ${n.message}`
  let cause = n.cause
  while (cause) {
    out += `\n  caused by: ${cause.stack || `${cause.name}: ${cause.message}`}`
    cause = cause.cause
  }
  return out
}

const logContextStorage = new AsyncLocalStorage<LogContext>()

/**
 * Run a function with an attached log context (e.g., request ID).
 * Use in HTTP middleware to propagate context through the request lifecycle.
 */
export function withLogContext<T>(context: LogContext, fn: () => T): T {
  return logContextStorage.run(context, fn)
}

/**
 * Get the current log context (if any).
 */
export function getLogContext(): LogContext | undefined {
  return logContextStorage.getStore()
}

async function initLogger(): Promise<void> {
  if (_logger) return
  if (_loggerInitPromise) return _loggerInitPromise

  // Drain buffered/in-flight writes on a natural shutdown (#1934).
  registerFlushOnExit()

  _loggerInitPromise = (async () => {
    // Read the project's `config/logging.ts` so it's the source of
    // truth (stacksjs/stacks#1935). Best-effort + lazy: any failure
    // falls back to env + defaults (today's behavior). Precedence is
    // **env var > config file > default**.
    let cfgLevel: string | undefined
    let cfgFormat: string | undefined
    let cfgLogDir: string | undefined
    let cfgWriteToFile: boolean | undefined
    try {
      const cfg = await import('@stacksjs/config') as {
        logging?: { level?: string, format?: string, writeToFile?: boolean, logsPath?: string }
      }
      const logging = cfg.logging
      if (logging) {
        cfgLevel = logging.level
        cfgFormat = logging.format
        if (typeof logging.writeToFile === 'boolean') cfgWriteToFile = logging.writeToFile
        if (logging.logsPath) {
          const np = await import('node:path')
          cfgLogDir = np.dirname(logging.logsPath)
        }
      }
    }
    catch {
      // Config layer unavailable (e.g. compiled binary with config
      // loading skipped) — env + defaults below still apply.
    }

    // env > config > default
    const { level, format, writeToFile } = resolveLogSettings({
      envLevel: process.env.LOG_LEVEL,
      envFormat: process.env.LOG_FORMAT,
      cfgLevel,
      cfgFormat,
      cfgWriteToFile,
      isProduction: process.env.NODE_ENV === 'production',
    })

    // Resolve the log directory: config's `logsPath` dir wins, else the
    // project's storage/logs, else a relative fallback.
    let logDirectory = cfgLogDir
    if (!logDirectory) {
      try {
        // Lazy import path to avoid a circular dependency (path imports logging).
        const p = await import('@stacksjs/path')
        logDirectory = p.projectPath('storage/logs')
      }
      catch {
        logDirectory = 'storage/logs'
      }
    }

    _logger = new Logger('stacks', {
      level,
      logDirectory,
      showTags: false,
      fancy: format !== 'json',
      format,
      writeToFile,
    })
  })()

  return _loggerInitPromise
}

async function getLogger(): Promise<Logger> {
  await initLogger()
  return _logger!
}

// Helper function to format message for logging, including request context
function formatMessage(...args: unknown[]): string {
  const base = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg),
  ).join(' ')

  // Prepend request ID if available
  const ctx = logContextStorage.getStore()
  if (ctx?.requestId) {
    return `[${ctx.requestId}] ${base}`
  }

  return base
}

export interface Log {
  info: (...args: unknown[]) => Promise<void>
  success: (msg: string) => Promise<void>
  /**
   * Log an error (stacksjs/stacks#1932).
   *
   * Preferred form: `log.error(message, error?, context?)` — `error`
   * is normalized (name/message/stack/cause) and folded into the line,
   * `context` is a typed {@link LogContext} attached as structured
   * fields. The first arg may also be the error itself
   * (`log.error(err)`).
   *
   * The legacy `log.error(err, { shouldExit })` options form still
   * works for back-compat but is deprecated — see {@link LogErrorOptions}.
   */
  error: (message: string | Error | unknown, error?: unknown, context?: LogContext) => Promise<void>
  warn: (arg: string, context?: LogContext) => Promise<void>
  warning: (arg: string) => Promise<void>
  debug: (...args: unknown[]) => Promise<void>
  dump: (...args: unknown[]) => Promise<void>
  dd: (...args: unknown[]) => Promise<void>
  echo: (...args: unknown[]) => Promise<void>
  time: (label: string) => (metadata?: LogContext) => Promise<void>
  /**
   * Synchronously write to stderr without going through the async file
   * logger. Use right before `process.exit` — the async `log.warn` /
   * `log.error` paths return a Promise, and `process.exit` kills the
   * runtime before that Promise resolves, so the message vanishes.
   */
  syncWarn: (msg: string) => void
  syncError: (msg: string) => void
  /**
   * Synchronously print a message to stderr and exit. Wraps the
   * "log a fatal then die" pattern so callers can't accidentally race
   * the async logger against `process.exit`.
   *
   * @example
   * if (!options.force) log.fatal('Aborting: clean state required')
   */
  fatal: (msg: string, exitCode?: number) => never
  /**
   * Await pending async log writes so a subsequent `process.exit` doesn't
   * truncate the output. Cheap when nothing is buffered.
   */
  flush: () => Promise<void>
}

export type ErrorMessage = string

/**
 * @deprecated stacksjs/stacks#1932 — the old union form
 * (`{…} | any | Error`) included `| any`, which collapsed the whole
 * union and let `log.error(msg, anything)` type-check while silently
 * dropping the error. Prefer `log.error(message, error?, context?)`.
 * This explicit object shape is retained only for the legacy
 * `{ shouldExit }` fatal path.
 */
export interface LogErrorOptions {
  shouldExit: boolean
  silent?: boolean
  message?: ErrorMessage
}

/** Whether a value is the legacy `LogErrorOptions` object (not an Error). */
function isLegacyErrorOptions(v: unknown): v is LogErrorOptions {
  return !!v
    && typeof v === 'object'
    && !(v instanceof Error)
    && ('shouldExit' in v || 'silent' in v || ('message' in v && Object.keys(v as object).length <= 3))
}

export const log: Log = {
  info: async (...args: any[]) => {
    const message = formatMessage(...args)
    const logger = await getLogger()
    await logger.info(message)
  },

  success: async (message: string) => {
    const logger = await getLogger()
    await logger.success(message)
  },

  warn: async (message: string, context?: LogContext) => {
    const logger = await getLogger()
    await logger.warn(message, context as Record<string, unknown> | undefined)
  },

  warning: async (message: string) => {
    const logger = await getLogger()
    await logger.warn(message)
  },

  error: async (message: string | Error | unknown, error?: unknown, context?: LogContext) => {
    // Three shapes, all typed now (stacksjs/stacks#1932):
    //   log.error('msg', err, ctx?)   — preferred
    //   log.error(err)                — error as the sole arg
    //   log.error(err, { shouldExit }) — legacy fatal options path
    const legacyOptions = isLegacyErrorOptions(error) ? error : undefined

    // Resolve the human-readable line.
    let line: string
    if (typeof message === 'string') {
      line = message
    }
    else {
      // First arg is itself the thrown value.
      line = renderNormalizedError(normalizeError(message))
    }

    // Fold in the attached error (when the 2nd arg isn't legacy options).
    if (error !== undefined && !legacyOptions) {
      line = `${line} ${renderNormalizedError(normalizeError(error))}`
    }

    // Attach structured context (explicit arg merged over request-scoped ctx).
    const mergedCtx = { ...getLogContext(), ...context }
    if (Object.keys(mergedCtx).length > 0) {
      try {
        line = `${line} ${JSON.stringify(mergedCtx)}`
      }
      catch {
        // Non-serializable context — skip rather than throw on the error path.
      }
    }

    const logger = await getLogger()
    await logger.error(line)

    // Legacy fatal path: only exit when explicitly asked.
    if (legacyOptions?.shouldExit) {
      handleError(message, legacyOptions)
    }
  },

  debug: async (...args: any[]) => {
    // Cheap-exit when the configured level suppresses debug (the default is
    // `info`). Hot paths call `log.debug` freely — per request through the
    // middleware chain, per route during registration — and without this
    // every call still ran formatMessage + getLogger + a level-filtered
    // logger.debug and left a floating Promise, despite emitting nothing.
    // Mirrors the underlying logger: debug ranks below info/warn/error.
    const lvl = ((process.env.LOG_LEVEL as string) || 'info').toLowerCase()
    if (lvl === 'info' || lvl === 'warn' || lvl === 'error')
      return
    const message = formatMessage(...args)
    const logger = await getLogger()
    await logger.debug(message)
  },

  dump: async (...args: any[]) => {
    const message = formatMessage(...args)
    const logger = await getLogger()
    // `dump` is the user-facing fire-and-forget debug helper. Awaiting the
    // write makes sure the message survives a quick `process.exit` after
    // the call (otherwise the disk transport's pending write gets dropped
    // and the user sees the dump line vanish).
    await logger.debug(`DUMP: ${message}`)
  },

  dd: async (...args: any[]) => {
    const message = formatMessage(...args)
    const logger = await getLogger()
    await logger.error(message)
    process.exit(ExitCode.FatalError)
  },

  echo: async (...args: any[]) => {
    const message = formatMessage(...args)
    const logger = await getLogger()
    await logger.info(`ECHO: ${message}`)
  },

  time: (label: string) => {
    const start = performance.now()
    return async (metadata?: LogContext) => {
      const duration = performance.now() - start
      const logger = await getLogger()
      const meta = metadata ? ` ${JSON.stringify(metadata)}` : ''
      await logger.info(`${label}: ${duration.toFixed(2)}ms${meta}`)
    }
  },

  syncWarn: (msg: string) => {
    // Direct stderr write — does not go through the async logger pipeline,
    // so the byte hits the TTY before the next instruction. Use this
    // immediately before `process.exit`.
    process.stderr.write(`${msg}\n`)
  },

  syncError: (msg: string) => {
    process.stderr.write(`${msg}\n`)
  },

  fatal: (msg: string, exitCode = ExitCode.FatalError): never => {
    process.stderr.write(`${msg}\n`)
    process.exit(exitCode)
  },

  flush: async (): Promise<void> => {
    // First drain any in-flight async writes (e.g. fire-and-forget
    // `log.struct.*`) so they reach the transport before we flush it
    // (stacksjs/stacks#1934). Settle, don't reject — a single failed
    // write must not abort the shutdown drain.
    if (pendingWrites.size > 0)
      await Promise.allSettled([...pendingWrites])

    // If the logger never initialized there's nothing to flush — `getLogger`
    // would create one we don't need. Same for the init-in-flight case;
    // those callers already have a Promise to await.
    if (!_logger && !_loggerInitPromise) return
    try {
      const logger = await getLogger()
      // `clarity`'s Logger exposes a `flush()` for transports that buffer.
      // It's optional in the type, so we call it dynamically and ignore
      // the case where the runtime instance doesn't have one.
      const maybeFlush = (logger as unknown as { flush?: () => Promise<void> }).flush
      if (typeof maybeFlush === 'function') await maybeFlush.call(logger)
    }
    catch {
      // Best-effort — never let flush fail crash a shutdown path.
    }
  },
}

// Export convenience functions
export async function dump(...args: any[]): Promise<void> {
  for (const arg of args) {
    await log.debug(arg)
  }
}

export async function dd(...args: any[]): Promise<never> {
  // Use console directly to guarantee output before exit
  const message = formatMessage(...args)
  console.log(message)
  process.exit(ExitCode.FatalError)
}

export async function echo(...args: any[]): Promise<void> {
  await log.debug(...args)
}

// Export logger getter for debugging
export { getLogger as logger }

export interface ReportOptions {
  /** Override the detected HTTP status (otherwise read from the error). */
  status?: number
  /** Extra structured context merged into the log line. */
  context?: LogContext
  /** Short label prefixed to the message (e.g. the handler path). */
  label?: string
}

/** Extract an HTTP status from a thrown value, if it carries one. */
function statusOf(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const e = error as { status?: unknown, statusCode?: unknown }
    if (typeof e.status === 'number') return e.status
    if (typeof e.statusCode === 'number') return e.statusCode
  }
  return undefined
}

/**
 * Single error→log chokepoint (stacksjs/stacks#1933) — Laravel's
 * `report()`. Every automatic error-logging path (router action catch,
 * request catch, process-level handlers) funnels through here so the
 * policy lives in one place:
 *
 *   - **4xx** (client errors — a thrown `HttpError(404)` / `422`) are
 *     NOT reported at error level; they're expected control flow, not
 *     server faults. Logged at debug so they stay traceable without
 *     spamming the error stream.
 *   - **5xx** and any non-HTTP throw are always reported at `error`
 *     with the full normalized stack + cause chain + request context.
 *
 * Fire-and-forget by design (callers are on a response / exit path);
 * the write is queued through the shared logger so a flush-on-exit
 * (stacksjs/stacks#1934) drains it.
 */
export function report(error: unknown, options: ReportOptions = {}): void {
  const status = options.status ?? statusOf(error)
  const isClientError = typeof status === 'number' && status >= 400 && status < 500
  const message = options.label ?? 'Unhandled error'
  const context: LogContext = { ...options.context, ...(status != null ? { status } : {}) }

  if (isClientError) {
    void log.debug(`${message} (client error ${status}): ${normalizeError(error).message}`)
    return
  }

  void log.error(message, error, context)
}

/**
 * Structured logging shorthands for common framework events.
 *
 * The bare `log.info("…")` form is good for ad-hoc messages, but the
 * framework emits a predictable set of events (HTTP requests, DB
 * queries, queued jobs, cache operations) that benefit from a stable
 * shape so downstream log shippers can index on consistent field
 * names.
 *
 * Each helper:
 *   1. Attaches the current trace id (if any) automatically
 *   2. Picks the appropriate severity based on outcome
 *   3. Emits a consistent JSON shape in production (`event`, `level`,
 *      `traceId`, …) while keeping the human-readable form in dev
 *
 * Helpers are batched onto `log.struct` so they don't pollute the
 * top-level `log` namespace, and so users can opt out by routing
 * `log.struct` to a custom transport in tests.
 */
interface StructuredFields { [key: string]: unknown }

function emit(level: 'debug' | 'info' | 'warn' | 'error', event: string, fields: StructuredFields): void {
  const ctx = getLogContext()
  const payload = {
    event,
    traceId: ctx?.requestId,
    ...fields,
  }
  // The underlying logger handles the dev vs prod formatting; we just
  // pass a single object so it prints as JSON in prod and as a
  // pretty key=value pairs view in dev. `warn` is typed as
  // `(string, options?)` so we serialise the payload before handing off.
  //
  // Tracked (not `void`-discarded) so `log.flush()` can drain these
  // before shutdown (stacksjs/stacks#1934).
  if (level === 'warn') {
    track(log.warn(`[${event}]`, payload as LogContext))
  }
  else {
    track(log[level](payload))
  }
}

export const struct = {
  /**
   * HTTP request completed. `status` is the response status code,
   * `durationMs` the wall time from request start to response sent.
   */
  request(method: string, path: string, status: number, durationMs: number, fields: StructuredFields = {}): void {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
    emit(level, 'http.request', { method, path, status, durationMs, ...fields })
  },

  /**
   * Database query completed. `durationMs` is the wall time at the
   * driver boundary.
   */
  query(sql: string, durationMs: number, fields: StructuredFields = {}): void {
    emit('debug', 'db.query', { sql, durationMs, ...fields })
  },

  /**
   * A slow query (over the slow-threshold) — emits at warn so it
   * surfaces in the default log filter.
   */
  slowQuery(sql: string, durationMs: number, fields: StructuredFields = {}): void {
    emit('warn', 'db.slow_query', { sql, durationMs, ...fields })
  },

  /**
   * Queue job lifecycle event. `phase` is `'started' | 'succeeded' |
   * 'failed' | 'released'`.
   */
  job(name: string, phase: 'started' | 'succeeded' | 'failed' | 'released', fields: StructuredFields = {}): void {
    const level = phase === 'failed' ? 'error' : 'info'
    emit(level, `job.${phase}`, { jobName: name, ...fields })
  },

  /**
   * Cache hit/miss event for warm-path debugging.
   */
  cache(op: 'hit' | 'miss' | 'set' | 'del', key: string, fields: StructuredFields = {}): void {
    emit('debug', `cache.${op}`, { key, ...fields })
  },
}

// Hang the structured surface off the canonical `log` export so consumers
// can do `log.struct.request(...)`. The mutation is safe because `log`
// is a singleton object literal we own.
;(log as Log & { struct: typeof struct }).struct = struct
