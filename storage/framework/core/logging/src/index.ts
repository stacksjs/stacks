import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'
import type { Prompt } from '@stacksjs/cli'
import { buddyOptions, prompt as getPrompt } from '@stacksjs/cli'
import { handleError } from '@stacksjs/error-handling'
import { logsPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { consola, createConsola } from 'consola'

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
    try {
      const logFilePath = logsPath('console.log')
      // Ensure the directory exists
      await mkdir(dirname(logFilePath), { recursive: true })
      // Append the message to the log file
      await appendFile(logFilePath, formattedMessage)
    } catch (error) {
      console.error('Failed to write to log file:', error)
    }
  } catch (error) {
    console.error('Failed to write to log file:', error)
  }
}

export interface Log {
  info: (...args: any[]) => void
  success: (msg: string) => void
  error: (err: string | Error | unknown, options?: any | Error) => void
  warn: (arg: string) => void
  debug: (...args: any[]) => void
  // start: logger.Start
  // box: logger.Box
  start: any
  box: any
  prompt: Prompt
  dump: (...args: any[]) => void
  dd: (...args: any[]) => void
  echo: (...args: any[]) => void
}

export const log: Log = {
  async info(...arg: any) {
    // @ts-expect-error intentional
    logger.info(...arg)
    await writeToLogFile(`INFO: ${arg}`)
  },

  async success(msg: string) {
    logger.success(msg)
    await writeToLogFile(`SUCCESS: ${msg}`)
  },

  async error(err: unknown, options?: any | Error) {
    if (err instanceof Error) handleError(err, options)
    else if (options instanceof Error) handleError(options)
    else handleError(err, options)

    await writeToLogFile(`ERROR: ${err}`)
  },

  async warn(arg: string) {
    logger.warn(arg)
    await writeToLogFile(`WARN: ${arg}`)
  },

  async debug(...arg: any) {
    if (process.env.APP_ENV === 'production' || process.env.APP_ENV === 'prod')
      return await writeToLogFile(`DEBUG: ${arg}`)

    logger.debug(arg)
    await writeToLogFile(`DEBUG: ${arg}`)
  },

  async start(...arg: any) {
    logger.start(arg)
    await writeToLogFile(`START: ${arg}`)
  },

  box: logger.box,

  get prompt() {
    return getPrompt()
  },

  dump,
  dd,
  echo,
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
