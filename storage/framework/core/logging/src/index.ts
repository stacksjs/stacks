/* eslint no-console: 0 */
import process from 'node:process'
import { Logger } from '@stacksjs/clarity'
import { handleError } from '@stacksjs/error-handling'
import * as p from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

// Initialize logger with default options
const logger = new Logger('stacks', {
  level: 'debug',
  logDirectory: p.projectPath('storage/logs'),
  showTags: false,
  fancy: true,
})

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
    await logger.info(message)
  },

  success: async (message: string) => {
    await logger.success(message)
  },

  warn: async (message: string, options?: Record<string, any>) => {
    await logger.warn(message, options)
  },

  warning: async (message: string) => {
    await logger.warn(message)
  },

  error: async (err: string | Error | object | unknown, options?: LogErrorOptions) => {
    const errorMessage = typeof err === 'string'
      ? err
      : err instanceof Error
        ? err
        : JSON.stringify(err)

    await logger.error(errorMessage)
    handleError(err, options)
  },

  debug: async (...args: any[]) => {
    const message = formatMessage(...args)
    await logger.debug(message)
  },

  dump: (...args: any[]) => {
    const message = formatMessage(...args)
    logger.debug(`DUMP: ${message}`)
  },

  dd: (...args: any[]) => {
    const message = formatMessage(...args)
    logger.error(message)
    process.exit(ExitCode.FatalError)
  },

  echo: (...args: any[]) => {
    const message = formatMessage(...args)
    logger.info(`ECHO: ${message}`)
  },

  time: (label: string) => {
    return logger.time(label)
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
