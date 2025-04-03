/* eslint no-console: 0 */
import process from 'node:process'
import { Logger } from '@stacksjs/clarity'
import { buddyOptions } from '@stacksjs/cli'
import { handleError, writeToLogFile } from '@stacksjs/error-handling'
import { ExitCode } from '@stacksjs/types'
import { consola, createConsola } from 'consola'

// Initialize loggers
const clarityLog = new Logger('stacks', {
  level: 'debug',
})
const consolaLogger = createConsola({
  level: determineLogLevel(),
})

// Helper function to determine log level based on verbose flag
function determineLogLevel(): number {
  const verboseRegex = /--verbose(?!\s*=\s*false|\s+false)(?:\s+|=true)?(?:$|\s)/
  const opts = buddyOptions()
  return verboseRegex.test(opts) ? 4 : 3
}

// Helper function to format message for logging
function formatMessage(...args: any[]): string {
  return args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ')
}

// Helper function to handle styled output
function handleStyledOutput(message: string, logger: any, method: string, options?: LogOptions) {
  if (options?.styled === false)
    console.log(message)
  else
    logger[method](message)
}

export interface Log {
  info: (...args: any[]) => void
  success: (msg: string) => void
  error: (err: string | Error | object | unknown, options?: ErrorOptions) => void
  warn: (arg: string) => void
  warning: (arg: string) => void
  debug: (...args: any[]) => void
  dump: (...args: any[]) => void
  dd: (...args: any[]) => void
  echo: (...args: any[]) => void
}

export interface LogOptions {
  styled?: boolean
}

export type ErrorMessage = string
export type ErrorOptions = {
  shouldExit: boolean
  silent?: boolean
  message?: ErrorMessage
} | any | Error

export const log: Log = {
  info: async (message: string, options?: LogOptions) => {
    handleStyledOutput(message, consolaLogger, 'info', options)
    clarityLog.info(message)
  },

  success: async (message: string, options?: LogOptions) => {
    handleStyledOutput(message, consolaLogger, 'success', options)
    clarityLog.info(`SUCCESS: ${message}`)
  },

  warn: async (message: string, options?: LogOptions) => {
    handleStyledOutput(message, consolaLogger, 'warn', options)
    clarityLog.warn(message)
  },

  warning: async (message: string, options?: LogOptions) => {
    handleStyledOutput(message, consolaLogger, 'warn', options)
    clarityLog.warn(message)
  },

  error: async (err: string | Error | object | unknown, options?: ErrorOptions) => {
    const errorMessage = typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : JSON.stringify(err)

    handleStyledOutput(errorMessage, consolaLogger, 'error', options)
    clarityLog.error(errorMessage)
    handleError(err, options)
  },

  debug: async (...args: any[]) => {
    const message = `${formatMessage(...args)}`

    if (process.env.APP_ENV === 'production' || process.env.APP_ENV === 'prod') {
      clarityLog.debug(message)
      return writeToLogFile(message)
    }

    consolaLogger.debug(`DEBUG: ${message}`)
    clarityLog.debug(message)
  },

  dump: (...args: any[]) => {
    const message = formatMessage(...args)
    console.log(message)
    clarityLog.debug(`DUMP: ${message}`)
  },

  dd: (...args: any[]) => {
    const message = formatMessage(...args)
    console.log(message)
    consolaLogger.error(message)
    clarityLog.error(message)
    process.exit(ExitCode.FatalError)
  },

  echo: (...args: any[]) => {
    const message = formatMessage(...args)
    console.log(message)
    clarityLog.info(`ECHO: ${message}`)
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
  console.log(...args)
}

export { consola, createConsola }
