import { access, appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'
import { prompts } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { handleError } from '@stacksjs/error-handling'
import { ExitCode } from '@stacksjs/types'
import { isString } from '@stacksjs/validation'
import isUnicodeSupported from 'is-unicode-supported'
import color from 'picocolors'

export async function writeToLogFile(message: string) {
  const formattedMessage = `[${new Date().toISOString()}] ${message}\n`

  try {
    const logFilePath = config.logging.logsPath ?? 'storage/logs/stacks.log'

    try {
      // Check if the file exists
      await access(logFilePath)
    } catch {
      // File doesn't exist, create the directory
      await mkdir(dirname(logFilePath), { recursive: true })
    }

    // Append the message to the log file
    await appendFile(logFilePath, formattedMessage)
  } catch (error) {
    console.error('Failed to write to log file:', error)
  }
}

export interface Log {
  info: (message: string, options?: LogMessageOptions) => void
  success: (message: string, options?: LogMessageOptions) => void
  error: (err: string | Error | unknown, options?: any | Error) => void
  warn: (message: string, options?: LogMessageOptions) => void
  warning: (message: string, options?: LogMessageOptions) => void
  debug: (message: string, options?: LogMessageOptions) => void
  message: (message: string, options?: LogMessageOptions) => void
  step: (message: string, options?: LogMessageOptions) => void
  dump: (...args: any[]) => void
  dd: (...args: any[]) => void
  echo: (...args: any[]) => void
}

const unicode = isUnicodeSupported()
const s = (c: string, fallback: string) => (unicode ? c : fallback)
const S_INFO = s('●', '•')
const S_SUCCESS = s('◆', '*')
const S_WARN = s('▲', '!')
const S_ERROR = s('■', 'x')
const S_BAR = s('│', '|')
const S_STEP_SUBMIT = s('◇', 'o')

export type LogMessageOptions = {
  symbol?: string
  styled?: boolean
}

export const log: Log = {
  message: (message = '', { symbol = color.gray(S_BAR), styled = true }: LogMessageOptions = {}) => {
    if (!styled) return process.stdout.write(`${message}\n`)

    const parts = [`${color.gray(S_BAR)}`]

    if (message) {
      const [firstLine, ...lines] = message.split('\n')
      parts.push(`${symbol}  ${firstLine}`, ...lines.map((ln) => `${color.gray(S_BAR)}  ${ln}`))
    }

    process.stdout.write(`${parts.join('\n')}\n`)
  },

  info: async (message: string, options?: LogMessageOptions) => {
    log.message(message, { symbol: color.blue(S_INFO), ...options })
    await writeToLogFile(`INFO: ${message}`)
  },

  success: async (message: string, options?: LogMessageOptions) => {
    log.message(message, { symbol: color.green(S_SUCCESS), ...options })
    await writeToLogFile(`SUCCESS: ${message}`)
  },

  step: async (message: string, options?: LogMessageOptions) => {
    log.message(message, { symbol: color.green(S_STEP_SUBMIT), ...options })
    await writeToLogFile(`STEP: ${message}`)
  },

  warn: async (message: string, options?: LogMessageOptions) => {
    log.message(message, { symbol: color.yellow(S_WARN), ...options })
    await writeToLogFile(`WARN: ${message}`)
  },

  /** alias for `log.warn()`. */
  warning: (message: string, options?: LogMessageOptions) => {
    log.warn(message, options)
  },

  error: (err: unknown, options?: any | Error) => {
    if (err instanceof Error) handleError(err, options)
    else if (err instanceof Error) handleError(options)
    else handleError(err, options)

    const errorMessage = isString(err) ? err : err instanceof Error ? err.message : String(err)
    log.message(errorMessage, { symbol: color.red(S_ERROR) })
    writeToLogFile(`ERROR: ${errorMessage}`)
  },

  debug: (...args: any[]) => {
    if (process.env.APP_ENV === 'production' || process.env.APP_ENV === 'prod')
      return writeToLogFile(`DEBUG: ${args.join(' ')}`)

    writeToLogFile(`DEBUG: ${args.join(' ')}`)
    log.debug(...args)
  },

  dump: (...args: any[]) => args.forEach((arg) => console.log(arg)),
  dd: (...args: any[]) => {
    args.forEach((arg) => console.log(arg))
    process.exit(ExitCode.FatalError)
  },
  echo: (...args: any[]) => console.log(...args),
}

export function dump(...args: any[]) {
  args.forEach((arg) => log.debug(arg))
}

export function dd(...args: any[]) {
  args.forEach((arg) => log.debug(arg))
  // we need to return a non-zero exit code to indicate an error
  // e.g. if used in a CDK script, we want it to fail the deployment
  process.exit(ExitCode.FatalError)
}

export function echo(...args: any[]) {
  console.log(...args)
}
