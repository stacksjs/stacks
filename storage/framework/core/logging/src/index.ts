import process from 'node:process'
import { consola, createConsola } from 'consola'
import { ExitCode } from '@stacksjs/types'
import { config } from '@stacksjs/config'
import { logsPath } from '@stacksjs/path'
import { handleError } from '@stacksjs/error-handling'
import type { Prompt } from '@stacksjs/cli'
import { buddyOptions, prompt as getPrompt } from '@stacksjs/cli'

export function logLevel() {
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
  // console.log('opts:', opts)
  // console.log('config:::', config)

  if (verboseRegex.test(opts))
    return 4

  return config.logger.level
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

export const logFilePath = logsPath('console.log')

async function writeToLogFile(message: string) {
  const formattedMessage = `[${new Date().toISOString()}] ${message}\n`
  try {
    const file = Bun.file(logFilePath)
    const writer = file.writer()
    const text = await file.text()
    writer.write(`${text}\n`)
    writer.write(`${formattedMessage}\n`)
    await writer.end()
  }
  catch (error) {
    // Assuming the error is due to the file not existing
    // Create the file and then write the message
    const file = Bun.file(logFilePath) // Use the create option
    const writer = file.writer()
    writer.write(`${formattedMessage}\n`)
    await writer.end()
  }
}

export interface Log {
  info: (...args: any[]) => void
  success: (msg: string) => void
  error: (err: string | Error, options?: any | Error) => void
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

  async error(err: string | Error, options?: any | Error) {
    if (err instanceof Error)
      handleError(err, options)
    else if (options instanceof Error)
      handleError(options)
    else
      handleError(err, options)

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
  args.forEach(arg => log.debug(arg))
}

export function dd(...args: any[]) {
  args.forEach(arg => log.debug(arg))
  // we need to return a non-zero exit code to indicate an error
  // e.g. if used in a CDK script, we want it to fail the deployment
  process.exit(ExitCode.FatalError)
}

export function echo(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args)
}
