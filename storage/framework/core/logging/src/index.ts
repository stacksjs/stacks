import { access, appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'
import { buddyOptions, stripAnsi } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { handleError } from '@stacksjs/error-handling'
import { ExitCode } from '@stacksjs/types'
import { isString } from '@stacksjs/validation'
import { consola, createConsola } from 'consola'

// import type { Prompt } from '@stacksjs/cli'

export function logLevel(): number {
  /**
   * This regex checks for:
   *   - --verbose true or --verbose=true exactly at the end of the string ($ denotes the end of the string).
   *   - --verbose - followed by optional spaces at the end.
   *   - --verbose followed by optional spaces at the end.
   *
   * .trim() is used on options to ensure any trailing spaces in the entire options string do not affect the regex match.
   */
  const verboseRegex = /--verbose(?!(\s*=\s*false|\s+false))(\s+|=true)?($|\s)/
  const opts = buddyOptions()

  if (verboseRegex.test(opts)) return 4

  // const config = await import('@stacksjs/config')
  // console.log('config', config)

  // return config.logger.level
  return 3
}

export const logger = createConsola({
  level: logLevel(),
  // fancy: true,
  // formatOptions: {
  //     columns: 80,
  //     colors: false,
  //     compact: false,
  //     date: false,
  // },
})

export { consola }

export async function writeToLogFile(message: string): Promise<void> {
  const formattedMessage = `[${new Date().toISOString()}] ${message}\n`

  try {
    const logFile = config.logging.logsPath ?? 'storage/logs/stacks.log'

    try {
      // Check if the file exists
      await access(logFile)
    } catch {
      // File doesn't exist, create the directory
      console.log('Creating log file directory...', logFile)
      await mkdir(dirname(logFile), { recursive: true })
    }

    // Append the message to the log file
    await appendFile(logFile, formattedMessage)
  } catch (error) {
    console.error('Failed to write to log file:', error)
  }
}

export interface Log {
  info: (...args: any[]) => void
  success: (msg: string) => void
  error: (err: string | Error | object | unknown, options?: any | Error) => void
  warn: (arg: string) => void
  warning: (arg: string) => void
  debug: (...args: any[]) => void
  // prompt: Prompt
  // start: logger.Start
  // box: logger.Box
  // start: any
  // box: any
  dump: (...args: any[]) => void
  dd: (...args: any[]) => void
  echo: (...args: any[]) => void
}

export type LogOptions = {
  styled?: boolean
}

export const log: Log = {
  info: async (message: string, options?: LogOptions) => {
    if (options?.styled === false) console.log(message)
    else logger.info(message)
    await writeToLogFile(`INFO: ${stripAnsi(message)}`)
  },

  success: async (message: string, options?: LogOptions) => {
    if (options?.styled === false) console.log(message)
    else logger.success(message)
    await writeToLogFile(`SUCCESS: ${stripAnsi(message)}`)
  },

  warn: async (message: string, options?: LogOptions) => {
    if (options?.styled === false) console.log(message)
    else logger.warn(message)
    await writeToLogFile(`WARN: ${stripAnsi(message)}`)
  },

  /** alias for `log.warn()`. */
  warning: async (message: string, options?: LogOptions) => {
    if (options?.styled === false) console.log(message)
    else logger.warn(message)
    await writeToLogFile(`WARN: ${stripAnsi(message)}`)
  },

  error: async (err: unknown, options?: any | Error) => {
    if (err instanceof Error) handleError(err, options)
    else if (err instanceof Error) handleError(options)
    else if (err instanceof Object) handleError(options)
    else handleError(err, options)

    const errorMessage = isString(err) ? err : err instanceof Error ? err.message : String(err)
    await writeToLogFile(`ERROR: ${stripAnsi(errorMessage)}`)
  },

  debug: async (...args: any[]) => {
    const formattedArgs = args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg))
    const message = `DEBUG: ${formattedArgs.join(' ')}`

    if (process.env.APP_ENV === 'production' || process.env.APP_ENV === 'prod') return writeToLogFile(message)

    logger.debug(message)
    await writeToLogFile(stripAnsi(message))
  },

  dump: (...args: any[]) => args.forEach((arg) => console.log(arg)),
  dd: (...args: any[]) => {
    args.forEach((arg) => console.log(arg))
    process.exit(ExitCode.FatalError)
  },
  echo: (...args: any[]) => console.log(...args),
}

export function dump(...args: any[]): void {
  args.forEach((arg) => log.debug(arg))
}

export function dd(...args: any[]): void {
  args.forEach((arg) => log.debug(arg))
  // we need to return a non-zero exit code to indicate an error
  // e.g. if used in a CDK script, we want it to fail the deployment
  process.exit(ExitCode.FatalError)
}

export function echo(...args: any[]): void {
  console.log(...args)
}
