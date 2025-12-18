/* eslint no-console: 0 */
import process from 'node:process'
import { Logger } from '@stacksjs/clarity'
import { handleError } from '@stacksjs/error-handling'
import { ExitCode } from '@stacksjs/types'

// Lazy logger initialization to avoid circular dependency with path
let _logger: Logger | null = null
let _loggerInitPromise: Promise<void> | null = null

async function initLogger(): Promise<void> {
  if (_logger) return
  if (_loggerInitPromise) return _loggerInitPromise

  _loggerInitPromise = (async () => {
    try {
      // Lazy import path to avoid circular dependency (path imports logging)
      const p = await import('@stacksjs/path')
      _logger = new Logger('stacks', {
        level: (process.env.LOG_LEVEL as any) || 'info',
        logDirectory: p.projectPath('storage/logs'),
        showTags: false,
        fancy: true,
      })
    }
    catch {
      // Path not available, use default directory
      _logger = new Logger('stacks', {
        level: (process.env.LOG_LEVEL as any) || 'info',
        logDirectory: 'storage/logs',
        showTags: false,
        fancy: true,
      })
    }
  })()

  return _loggerInitPromise
}

async function getLogger(): Promise<Logger> {
  await initLogger()
  return _logger!
}

// Helper function to format message for logging
function formatMessage(...args: any[]): string {
  return args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg),
  ).join(' ')
}

export interface Log {
  info: (...args: any[]) => void
  success: (msg: string) => void
  error: (err: string | Error | object | unknown, options?: LogErrorOptions) => void
  warn: (arg: string, options?: Record<string, any>) => void
  warning: (arg: string) => void
  debug: (...args: any[]) => void
  dump: (...args: any[]) => void
  dd: (...args: any[]) => void
  echo: (...args: any[]) => void
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
    await logger.warn(message, options)
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
    handleError(err, options)
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
    // For time, we need to return a promise that resolves to the time function
    return (async () => {
      const logger = await getLogger()
      return logger.time(label)
    })() as any
  },
}

// Export convenience functions
export function dump(...args: any[]): void {
  args.forEach(arg => log.debug(arg))
}

export function dd(...args: any[]): void {
  log.info(args)
  process.exit(ExitCode.FatalError)
}

export function echo(...args: any[]): void {
  log.debug(...args)
}

// Export logger getter for debugging
export { getLogger as logger }
