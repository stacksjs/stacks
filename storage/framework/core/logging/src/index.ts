import { access, appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'
import { buddyOptions } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { handleError } from '@stacksjs/error-handling'
import { ExitCode } from '@stacksjs/types'
import { isString } from '@stacksjs/validation'
import { consola, createConsola } from 'consola'

// import type { Prompt } from '@stacksjs/cli'

export async function logLevel() {
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

  return 3
  // return config.logger.level
}

export const logger = createConsola({
  level: await logLevel(),
  // fancy: true,
  // formatOptions: {
  //     columns: 80,
  //     colors: false,
  //     compact: false,
  //     date: false,
  // },
})

export { consola }

export async function writeToLogFile(message: string) {
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
  error: (err: string | Error | unknown, options?: any | Error) => void
  warn: (arg: string) => void
  warning: (arg: string) => void
  debug: (...args: any[]) => void
  // prompt: Prompt
  // start: logger.Start
  // box: logger.Box
  start: any
  box: any
  dump: (...args: any[]) => void
  dd: (...args: any[]) => void
  echo: (...args: any[]) => void
}

export type LogMessageOptions = {
  symbol?: string
  styled?: boolean
}

export const log: Log = {
  info: async (message: string) => {
    logger.info(message)
    await writeToLogFile(`INFO: ${message}`)
  },

  success: async (message: string) => {
    logger.success(message)
    await writeToLogFile(`SUCCESS: ${message}`)
  },

  warn: async (message: string) => {
    logger.warn(message)
    await writeToLogFile(`WARN: ${message}`)
  },

  /** alias for `log.warn()`. */
  warning: (message: string) => {
    log.warn(message)
  },

  error: (err: unknown, options?: any | Error) => {
    if (err instanceof Error) handleError(err, options)
    else if (err instanceof Error) handleError(options)
    else handleError(err, options)

    const errorMessage = isString(err) ? err : err instanceof Error ? err.message : String(err)
    logger.error(errorMessage)
    writeToLogFile(`ERROR: ${errorMessage}`)
  },

  debug: (...args: any[]) => {
    if (process.env.APP_ENV === 'production' || process.env.APP_ENV === 'prod')
      return writeToLogFile(`DEBUG: ${args.join(' ')}`)

    writeToLogFile(`DEBUG: ${args.join(' ')}`)
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
