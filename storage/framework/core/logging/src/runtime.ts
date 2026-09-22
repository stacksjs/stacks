import type { Log, ReportOptions } from './index'
import process from 'node:process'

type RuntimeLog = Pick<Log, 'info' | 'warn' | 'error' | 'debug' | 'flush'>
type LoggingModule = typeof import('./index')

const CONFIG_READY_KEY = Symbol.for('@stacksjs/config:overridesReady')
const IMPLEMENTATION_LOADED_KEY = Symbol.for('@stacksjs/logging:implementation-loaded')
const SUPPRESSED_LEVELS = new Set(['info', 'success', 'warn', 'warning', 'error'])

let implementationLoad: Promise<LoggingModule> | undefined
const resolvedVoid = Promise.resolve()
let cachedConfigSignal: Promise<LoggingConfiguration | undefined> | undefined
let cachedConfigNeedsDebug: boolean | undefined

function loadImplementation(): Promise<LoggingModule> {
  return implementationLoad ??= import('./index')
}

function implementationIsLoaded(): boolean {
  return (globalThis as Record<symbol, unknown>)[IMPLEMENTATION_LOADED_KEY] === true
}

interface LoggingConfiguration {
  logging?: {
    level?: string
    transports?: unknown
  }
}

function configurationNeedsDebug(configuration: LoggingConfiguration | undefined, envLevel: string | undefined): boolean {
  const logging = configuration?.logging
  if (Array.isArray(logging?.transports) && logging.transports.length > 0)
    return true
  if (envLevel)
    return envLevel === 'debug'

  const level = logging?.level?.toLowerCase()
  return level === 'debug' || (level !== undefined && !SUPPRESSED_LEVELS.has(level))
}

function delegateDebug(args: unknown[]): Promise<void> {
  if (implementationIsLoaded())
    return loadImplementation().then(module => module.log.debug(...args))

  const rawLevel = process.env.LOG_LEVEL
  const envLevel = rawLevel?.toLowerCase()
  if (envLevel) {
    return SUPPRESSED_LEVELS.has(envLevel)
      ? resolvedVoid
      : loadImplementation().then(module => module.log.debug(...args))
  }

  const ready = (globalThis as Record<symbol, unknown>)[CONFIG_READY_KEY]
  if (!ready || typeof (ready as Promise<unknown>).then !== 'function')
    return resolvedVoid

  const signal = ready as Promise<LoggingConfiguration | undefined>
  if (signal !== cachedConfigSignal) {
    cachedConfigSignal = signal
    cachedConfigNeedsDebug = undefined
  }
  else if (cachedConfigNeedsDebug !== undefined) {
    return cachedConfigNeedsDebug
      ? loadImplementation().then(module => module.log.debug(...args))
      : resolvedVoid
  }

  const current = Bun.peek(signal)
  if (current !== signal) {
    cachedConfigNeedsDebug = configurationNeedsDebug(current as LoggingConfiguration | undefined, undefined)
    return cachedConfigNeedsDebug
      ? loadImplementation().then(module => module.log.debug(...args))
      : resolvedVoid
  }

  return signal.then((configuration) => {
    const needsDebug = configurationNeedsDebug(configuration, undefined)
    if (cachedConfigSignal === signal)
      cachedConfigNeedsDebug = needsDebug
    if (needsDebug)
      return loadImplementation().then(module => module.log.debug(...args))
  })
}

/**
 * Quiet server processes only need the logging facade when a record is
 * emitted. Keep router imports small, then hand every real record to the
 * complete logger so formatting, transports, context, and file output retain
 * one implementation.
 */
export const log: RuntimeLog = {
  info: (...args) => loadImplementation().then(module => module.log.info(...args)),
  warn: (...args) => loadImplementation().then(module => module.log.warn(...args)),
  error: (...args) => loadImplementation().then(module => module.log.error(...args)),
  debug: (...args) => delegateDebug(args),
  flush: () => loadImplementation().then(module => module.log.flush()),
}

export function report(error: unknown, options: ReportOptions = {}): void {
  void loadImplementation().then(module => module.report(error, options))
}
