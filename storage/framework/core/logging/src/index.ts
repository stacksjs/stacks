/* eslint no-console: 0 */
import { AsyncLocalStorage } from 'node:async_hooks'
import process from 'node:process'
import { Logger } from '@stacksjs/clarity'
import { handleError } from '@stacksjs/error-handling'
import { ExitCode } from '@stacksjs/types'

// Lazy logger initialization to avoid circular dependency with path
let _logger: Logger | null = null
let _loggerInitPromise: Promise<void> | null = null

// Request context propagation for structured logging
interface LogContext {
  requestId?: string
  userId?: string | number
  [key: string]: unknown
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

  _loggerInitPromise = (async () => {
    // Determine format: JSON for production, text for development
    const format = process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'text')

    try {
      // Lazy import path to avoid circular dependency (path imports logging)
      const p = await import('@stacksjs/path')
      _logger = new Logger('stacks', {
        level: (process.env.LOG_LEVEL as any) || 'info',
        logDirectory: p.projectPath('storage/logs'),
        showTags: false,
        fancy: format !== 'json',
        format: format as any,
        writeToFile: true,
      })
    }
    catch {
      // Path not available, use default directory
      _logger = new Logger('stacks', {
        level: (process.env.LOG_LEVEL as any) || 'info',
        logDirectory: 'storage/logs',
        showTags: false,
        fancy: format !== 'json',
        format: format as any,
        writeToFile: true,
      })
    }
  })()

  return _loggerInitPromise
}

async function getLogger(): Promise<Logger> {
  await initLogger()
  return _logger!
}

// Helper function to format message for logging, including request context
function formatMessage(...args: any[]): string {
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
  info: (...args: any[]) => Promise<void>
  success: (msg: string) => Promise<void>
  error: (err: string | Error | object | unknown, options?: LogErrorOptions) => Promise<void>
  warn: (arg: string, options?: Record<string, any>) => Promise<void>
  warning: (arg: string) => Promise<void>
  debug: (...args: any[]) => Promise<void>
  dump: (...args: any[]) => Promise<void>
  dd: (...args: any[]) => Promise<void>
  echo: (...args: any[]) => Promise<void>
  time: (label: string) => (metadata?: Record<string, any>) => Promise<void>
}

export type ErrorMessage = string

export type LogErrorOptions = {
  shouldExit: boolean
  silent?: boolean
  message?: ErrorMessage
} | any | Error

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

  warn: async (message: string, options?: Record<string, any>) => {
    const logger = await getLogger()
    await logger.warn(message, options as any)
  },

  warning: async (message: string) => {
    const logger = await getLogger()
    await logger.warn(message)
  },

  error: async (err: string | Error | object | unknown, options?: LogErrorOptions) => {
    const errorMessage = typeof err === 'string'
      ? err
      : err instanceof Error
        ? err
        : JSON.stringify(err)

    const logger = await getLogger()
    await logger.error(errorMessage)

    // Only call handleError if explicitly requested (e.g., fatal errors)
    // Default behavior: log the error without killing the process
    if (options?.shouldExit) {
      handleError(err, options)
    }
  },

  debug: async (...args: any[]) => {
    const message = formatMessage(...args)
    const logger = await getLogger()
    await logger.debug(message)
  },

  dump: async (...args: any[]) => {
    const message = formatMessage(...args)
    const logger = await getLogger()
    logger.debug(`DUMP: ${message}`)
  },

  dd: async (...args: any[]) => {
    const message = formatMessage(...args)
    const logger = await getLogger()
    logger.error(message)
    process.exit(ExitCode.FatalError)
  },

  echo: async (...args: any[]) => {
    const message = formatMessage(...args)
    const logger = await getLogger()
    logger.info(`ECHO: ${message}`)
  },

  time: (label: string) => {
    const start = performance.now()
    return async (metadata?: Record<string, any>) => {
      const duration = performance.now() - start
      const logger = await getLogger()
      const meta = metadata ? ` ${JSON.stringify(metadata)}` : ''
      await logger.info(`${label}: ${duration.toFixed(2)}ms${meta}`)
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
