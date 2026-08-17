/* eslint no-console: 0 */
import type { LogContext, LogLevel, LogRecord, LogTransport } from '@stacksjs/types'
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

// --- Transports -------------------------------------------------------------
//
// Everything the framework logs also goes to any registered transport, so a
// log service, an OTel exporter, or a test sink can see the stream without the
// application rewriting a single call site.
//
// Transports receive the record BEFORE formatting collapses it: `args` still
// holds the real `Error` and the real context object. That is the whole point
// of the seam. A formatter would only ever see the string.

const _transports: LogTransport[] = []

/** Transports that have thrown. Reported once each, then left alone. */
const _brokenTransports = new Set<string>()

/**
 * Severity ranking for a transport's own `level` filter.
 *
 * `success` ranks with `info` deliberately: it is an outcome, not a severity,
 * and a transport asking for `warning` and above does not want it.
 */
const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  success: 1,
  warning: 2,
  error: 3,
}

function addTransport(candidate: unknown): (() => void) | null {
  const t = candidate as LogTransport | undefined
  if (!t || typeof t !== 'object' || typeof t.log !== 'function') {
    process.stderr.write('[logging] Ignoring a transport without a log() function.\n')
    return null
  }
  if (typeof t.name !== 'string' || !t.name) {
    process.stderr.write('[logging] Ignoring a transport without a name.\n')
    return null
  }

  _transports.push(t)
  return () => {
    const at = _transports.indexOf(t)
    if (at !== -1) _transports.splice(at, 1)
  }
}

/**
 * Attach a transport at runtime, and get back a function that detaches it.
 *
 * The alternative to declaring one in `config/logging.ts`, for a package that
 * has to attach without the application editing its config. Registering also
 * initializes the logger, so a transport attached at boot starts receiving
 * `debug` records immediately rather than waiting for the first console-visible
 * line to build the config.
 */
export function registerTransport(transport: LogTransport): () => void {
  const detach = addTransport(transport)
  if (!detach) return () => {}
  void initLogger()
  return detach
}

/** The transports currently attached. A copy, so callers cannot mutate the list. */
export function transports(): readonly LogTransport[] {
  return [..._transports]
}

/**
 * Hand one record to every transport that wants it.
 *
 * Synchronous and total: a transport that throws is contained and reported
 * once, because the logger is frequently the thing reporting a failure and it
 * must not become a second one. Cheap when nothing is attached, which is the
 * common case and the reason for the length check at every call site.
 */
function dispatch(level: LogLevel, message: string, args: unknown[]): void {
  if (_transports.length === 0) return

  let record: LogRecord
  try {
    record = {
      level,
      message,
      args,
      context: getLogContext(),
      timestamp: new Date().toISOString(),
    }
  }
  catch {
    // Building the record must never take a log call down with it.
    return
  }

  for (const transport of _transports) {
    if (transport.level && LEVEL_RANK[level] < LEVEL_RANK[transport.level])
      continue
    try {
      transport.log(record)
    }
    catch (err) {
      if (!_brokenTransports.has(transport.name)) {
        _brokenTransports.add(transport.name)
        const reason = err instanceof Error ? err.message : String(err)
        process.stderr.write(`[logging] Transport "${transport.name}" threw: ${reason}. Further throws from it are silent.\n`)
      }
    }
  }
}

/** Drain every transport that buffers. Never rejects; see {@link LogTransport.flush}. */
async function flushTransports(): Promise<void> {
  const pending = _transports
    .filter(t => typeof t.flush === 'function')
    .map(t => t.flush!().catch(() => {}))
  if (pending.length > 0)
    await Promise.allSettled(pending)
}

// Request context propagation for structured logging, and the transport
// contract. Both are declared in `@stacksjs/types` so `config/logging.ts` can
// reference them without importing this package, which would be a cycle. They
// are re-exported here because this is where consumers already import them
// from.
export type { LogContext, LogLevel, LogRecord, LogTransport } from '@stacksjs/types'

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
    // Walk the object first so embedded Errors survive — a bare
    // `JSON.stringify` would erase them to `{}` (stacksjs/stacks#1956).
    // This is the path `log.error(msg, contextObject)` and the
    // `log.struct` error-level emits land on.
    return { name: 'Error', message: JSON.stringify(normalizeContextValue(err)) }
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

/**
 * Normalize context values so embedded `Error`s survive JSON
 * serialization (stacksjs/stacks#1956). `JSON.stringify(new Error())`
 * yields `{}` (message/stack are non-enumerable), so any Error placed
 * in a context object — `log.warn('…', { error: err })` — was silently
 * erased from the log line. Walks plain objects and arrays (bounded)
 * and converts each Error via {@link normalizeError}; everything else
 * passes through untouched.
 */
function normalizeContextValue(value: unknown, depth = 0): unknown {
  if (value instanceof Error)
    return normalizeError(value)
  if (depth >= 4 || value === null || typeof value !== 'object')
    return value
  if (Array.isArray(value))
    return value.map(v => normalizeContextValue(v, depth + 1))
  // Only walk plain objects — class instances (Date, Map, …) keep
  // their existing JSON.stringify behavior.
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null)
    return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>))
    out[k] = normalizeContextValue(v, depth + 1)
  return out
}

/** Apply {@link normalizeContextValue} to a structured log context. */
export function normalizeContext(ctx: LogContext): LogContext {
  return normalizeContextValue(ctx) as LogContext
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
 * Get the current log context (if any), with the active trace id folded in.
 *
 * The trace is read from the router's own AsyncLocalStorage through the
 * process-global symbol it publishes, rather than by importing
 * `@stacksjs/router` - which would be a cycle, since the router imports this.
 * That symbol is already a deliberate cross-copy contract (see
 * `request-context.ts`), so reading it here is using the seam rather than
 * reaching around one.
 *
 * Why it belongs here at all: a log line without a request id is a log line
 * nobody can join to anything. The id follows a request into its jobs now, and
 * the only place that becomes *useful* is the log.
 *
 * An explicit context wins, so a caller who sets `trace_id` deliberately - a
 * migration script correlating to a deploy, say - is not overwritten by an
 * ambient one.
 */
export function getLogContext(): LogContext | undefined {
  const store = logContextStorage.getStore()
  const trace = activeTraceId()

  if (!trace)
    return store

  return { trace_id: trace, ...store }
}

/**
 * The router's active trace id, if this process has a router and a request.
 *
 * Defensive to the point of paranoia on purpose: this runs inside the logger,
 * and a logger that throws while reporting a failure turns one problem into a
 * silent one.
 */
function activeTraceId(): string | undefined {
  try {
    const storage = (globalThis as Record<symbol, unknown>)[Symbol.for('stacks.router.traceStorage')] as
      | { getStore: () => string | undefined }
      | undefined

    const explicit = storage?.getStore?.()
    if (explicit)
      return explicit

    const requests = (globalThis as Record<symbol, unknown>)[Symbol.for('stacks.router.requestStorage')] as
      | { getStore: () => { _requestId?: string } | undefined }
      | undefined

    return requests?.getStore?.()?._requestId
  }
  catch {
    return undefined
  }
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
        logging?: { level?: string, format?: string, writeToFile?: boolean, logsPath?: string, transports?: unknown }
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
        // Config-declared transports. Added directly rather than through
        // `registerTransport`, which would re-enter this function.
        if (Array.isArray(logging.transports)) {
          for (const transport of logging.transports)
            addTransport(transport)
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

// Helper function to format message for logging, including request context.
// Exported for direct unit testing of arg handling (stacksjs/stacks#2047).
export function formatMessage(...args: unknown[]): string {
  // Errors (bare or nested in object args) need normalizing first —
  // `JSON.stringify(new Error())` is `{}` (stacksjs/stacks#1956).
  const base = args
    // Drop `undefined` args so a call with a missing trailing context/format
    // arg — e.g. `log.warn(`... database "${name}"`, ctx)` where `ctx` is
    // undefined — doesn't leave a stray " undefined" at the end of the line
    // (stacksjs/stacks#2047). `null` is kept: it's usually a deliberate value.
    .filter(arg => arg !== undefined)
    .map((arg) => {
      if (arg instanceof Error)
        return renderNormalizedError(normalizeError(arg))
      if (typeof arg === 'object' && arg !== null)
        return JSON.stringify(normalizeContextValue(arg), null, 2)
      return String(arg)
    }).join(' ')

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
  warn: (arg: string, context?: unknown) => Promise<void>
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
  /**
   * Flush, then exit.
   *
   * The counterpart to {@link fatal} for the path a command actually takes
   * most often — it succeeded, it said so, and now it wants to end. Writing
   * that as `log.success(...)` followed by `process.exit(0)` drops the
   * message: the write is async and `process.exit` does not wait, so the one
   * line the operator was watching for is the one that never arrives, and the
   * command reads as having hung partway through work it in fact completed.
   *
   * The message is logged at the level the exit code implies: success when
   * exiting 0, error otherwise. A command that stops with a non-zero code is
   * reporting a failure, and printing that in green under a SUCCESS label
   * tells the operator the opposite of what happened.
   *
   * @example
   * await log.exit(`Indexed ${count} products`)
   * await log.exit(`No index to write to`, 1)
   */
  exit: (msg?: string, exitCode?: number) => Promise<never>
}

export type ErrorMessage = string

/**
 * Options for the fatal path: `log.error(message, { shouldExit: true })`.
 *
 * Kept as an explicit object shape rather than folded into a union with
 * `Error`. The old union included `| any`, which collapsed the whole thing and
 * let `log.error(msg, anything)` type check while silently dropping the error
 * (stacksjs/stacks#1932). For ordinary reporting use
 * `log.error(message, error?, context?)`.
 */
export interface LogErrorOptions {
  shouldExit: boolean
  silent?: boolean
  message?: ErrorMessage
}

const LEGACY_ERROR_OPTION_KEYS: ReadonlySet<string> = new Set(['shouldExit', 'silent', 'message'])

/** Whether a value is the legacy `LogErrorOptions` object (not an Error). */
function isLegacyErrorOptions(v: unknown): v is LogErrorOptions {
  if (!v || typeof v !== 'object' || v instanceof Error)
    return false
  // Legacy options always carry an exit/silence flag. A bare `message`
  // key is not enough — real contexts like `{ type, message, error }`
  // matched the old "<= 3 keys with message" heuristic and were
  // swallowed whole (stacksjs/stacks#1956). Unknown keys also disqualify
  // so a context that happens to contain `shouldExit` can't trigger the
  // fatal-exit path.
  if (!('shouldExit' in v || 'silent' in v))
    return false
  return Object.keys(v).every(k => LEGACY_ERROR_OPTION_KEYS.has(k))
}

export const log: Log = {
  info: async (...args: any[]) => {
    const message = formatMessage(...args)
    const logger = await getLogger()
    // Before the write, not after: a transport should still see the line if
    // the console or file write is the thing that fails.
    dispatch('info', message, args)
    await logger.info(message)
  },

  success: async (message: string) => {
    const logger = await getLogger()
    dispatch('success', message, [message])
    await logger.success(message)
  },

  warn: async (message: string, context?: unknown) => {
    const logger = await getLogger()
    dispatch('warning', message, context === undefined ? [message] : [message, context])
    // No context → call with a single arg. Passing a nullish second arg makes
    // clarity stringify it and append a stray " undefined" / " null" to the
    // line (e.g. `log.warn('… All data will be lost.')`, or `log.warn(msg,
    // null)`). `== null` catches both. Matches `warning`.
    if (context == null) {
      await logger.warn(message)
      return
    }
    // Normalize so Errors in the context survive clarity's JSON.stringify
    // (stacksjs/stacks#1956).
    const normalized = normalizeContextValue(context) as Record<string, unknown>
    await logger.warn(message, normalized)
  },

  warning: async (message: string) => {
    const logger = await getLogger()
    dispatch('warning', message, [message])
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
        line = `${line} ${JSON.stringify(normalizeContext(mergedCtx))}`
      }
      catch {
        // Non-serializable context — skip rather than throw on the error path.
      }
    }

    const logger = await getLogger()
    // The raw call, not the assembled line: a transport building structured
    // output wants the `Error` itself and the context as an object, which is
    // exactly what `line` has just finished flattening into a string.
    dispatch('error', line, legacyOptions ? [message] : [message, error, context].filter(a => a !== undefined))
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
    const suppressed = lvl === 'info' || lvl === 'warn' || lvl === 'error'

    // The fast path is unchanged when nothing is attached, which is the common
    // case. A transport, though, is allowed to be more verbose than the
    // terminal: shipping debug lines to a log service while keeping the console
    // at info is a normal thing to want, and suppressing them here would make
    // it impossible.
    if (suppressed && _transports.length === 0)
      return

    const message = formatMessage(...args)
    if (suppressed) {
      dispatch('debug', message, args)
      return
    }

    const logger = await getLogger()
    dispatch('debug', message, args)
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
      const meta = metadata ? ` ${JSON.stringify(normalizeContext(metadata))}` : ''
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

  exit: async (msg?: string, exitCode = ExitCode.Success): Promise<never> => {
    if (msg)
      await (exitCode === ExitCode.Success ? log.success(msg) : log.error(msg))

    await log.flush()
    process.exit(exitCode)
  },

  flush: async (): Promise<void> => {
    // First drain any in-flight async writes (e.g. fire-and-forget
    // `log.struct.*`) so they reach the transport before we flush it
    // (stacksjs/stacks#1934). Settle, don't reject — a single failed
    // write must not abort the shutdown drain.
    if (pendingWrites.size > 0)
      await Promise.allSettled([...pendingWrites])

    // Transports drain after the in-flight writes, so a record dispatched by
    // one of those writes is in the transport's buffer before we ask it to
    // deliver. `beforeExit` already calls this, so a buffering transport gets
    // its chance on a natural shutdown without registering its own hook.
    await flushTransports()

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
