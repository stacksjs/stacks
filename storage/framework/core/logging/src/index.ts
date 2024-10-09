import process from 'node:process'
import { buddyOptions, stripAnsi } from '@stacksjs/cli'
import { handleError, writeToLogFile } from '@stacksjs/error-handling'
import { ExitCode } from '@stacksjs/types'
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

  if (verboseRegex.test(opts))
    return 4

  // const config = await import('@stacksjs/config')
  // console.log('config', config)

  // return config.logger.level
  return 3
}

export const logger: Log = {
  ...createConsola({
    level: logLevel(),
    // fancy: true,
  }),
  warning: (message: string) => console.warn(message),
  dump: (...args: any[]) => console.log(...args),
  dd: (...args: any[]) => {
    console.log(...args)
    process.exit(ExitCode.FatalError)
  },
  echo: (message: string) => console.log(message),
}

export { consola, createConsola }

type ErrorMessage = string
export type ErrorOptions =
  | {
    shouldExit: boolean
    silent?: boolean
    message?: ErrorMessage
  }
  | any
  | Error

export interface Log {
  info: (...args: any[]) => void
  success: (msg: string) => void
  error: (err: string | Error | object | unknown, options?: ErrorOptions) => void
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

export interface LogOptions {
  styled?: boolean
}

export const log: Log = {
  info: async (message: string, options?: LogOptions) => {
    if (options?.styled === false)
      console.log(message)
    else logger.info(message)
    await writeToLogFile(`INFO: ${stripAnsi(message)}`)
  },

  success: async (message: string, options?: LogOptions) => {
    if (options?.styled === false)
      console.log(message)
    else logger.success(message)
    await writeToLogFile(`SUCCESS: ${stripAnsi(message)}`)
  },

  warn: async (message: string, options?: LogOptions) => {
    if (options?.styled === false)
      console.log(message)
    else logger.warn(message)
    await writeToLogFile(`WARN: ${stripAnsi(message)}`)
  },

  /** alias for `log.warn()`. */
  warning: async (message: string, options?: LogOptions) => {
    if (options?.styled === false)
      console.log(message)
    else logger.warn(message)
    await writeToLogFile(`WARN: ${stripAnsi(message)}`)
  },

  error: async (err: string | Error | object | unknown, options?: ErrorOptions) => {
    handleError(err, options)
  },

  debug: async (...args: any[]) => {
    const formattedArgs = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg))
    const message = `DEBUG: ${formattedArgs.join(' ')}`

    if (process.env.APP_ENV === 'production' || process.env.APP_ENV === 'prod')
      return writeToLogFile(message)

    logger.debug(message)
    await writeToLogFile(stripAnsi(message))
  },

  dump: (...args: any[]) => args.forEach(arg => console.log(arg)),
  dd: (...args: any[]) => {
    args.forEach(arg => console.log(arg))
    process.exit(ExitCode.FatalError)
  },
  echo: (...args: any[]) => console.log(...args),
}

export function dump(...args: any[]): void {
  args.forEach(arg => log.debug(arg))
}

export function dd(...args: any[]): void {
  log.info(args)
  // we need to return a non-zero exit code to indicate an error
  // e.g. if used in a CDK script, we want it to fail the deployment
  process.exit(ExitCode.FatalError)
}

export function echo(...args: any[]): void {
  console.log(...args)
}
