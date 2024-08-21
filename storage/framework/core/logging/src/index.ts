import { access, appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'
import type { Prompt } from '@stacksjs/cli'
import { buddyOptions, prompt as getPrompt } from '@stacksjs/cli'
import { handleError } from '@stacksjs/error-handling'
import { logsPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { isString } from '@stacksjs/validation'
import { consola, createConsola } from 'consola'
import color from 'picocolors'

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
  level: 3,
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
    const logFilePath = logsPath('console.log')

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
  info: (...args: any[]) => void
  success: (message: string) => void
  error: (err: string | Error | unknown, options?: any | Error) => void
  warn: (message: string) => void
  warning: (message: string) => void
  debug: (...args: any[]) => void
  message: (message: string, options?: LogMessageOptions) => void
  step: (message: string) => void
  // start: logger.Start
  // box: logger.Box
  start: any
  box: any
  prompt: () => Prompt
  dump: (...args: any[]) => void
  dd: (...args: any[]) => void
  echo: (...args: any[]) => void
}

const s = (c: string, fallback: string) => (unicode ? c : fallback)
const S_INFO = s('●', '•')
const S_SUCCESS = s('◆', '*')
const S_WARN = s('▲', '!')
const S_ERROR = s('■', 'x')
const S_BAR = s('│', '|')
const S_STEP_SUBMIT = s('◇', 'o')

export type LogMessageOptions = {
  symbol?: string
}

export const log: Log = {
  message: (message = '', { symbol = color.gray(S_BAR) }: LogMessageOptions = {}) => {
    const parts = [`${color.gray(S_BAR)}`]

    if (message) {
      const [firstLine, ...lines] = message.split('\n')
      parts.push(`${symbol}  ${firstLine}`, ...lines.map((ln) => `${color.gray(S_BAR)}  ${ln}`))
    }

    process.stdout.write(`${parts.join('\n')}\n`)
  },

  info: async (message: string) => {
    log.message(message, { symbol: color.blue(S_INFO) })
    await writeToLogFile(`INFO: ${message}`)
  },

  success: async (message: string) => {
    log.message(message, { symbol: color.green(S_SUCCESS) })
    await writeToLogFile(`SUCCESS: ${message}`)
  },

  step: async (message: string) => {
    log.message(message, { symbol: color.green(S_STEP_SUBMIT) })
    await writeToLogFile(`STEP: ${message}`)
  },

  warn: async (message: string) => {
    log.message(message, { symbol: color.yellow(S_WARN) })
    await writeToLogFile(`WARN: ${message}`)
  },

  /** alias for `log.warn()`. */
  warning: (message: string) => {
    log.warn(message)
  },

  error: (message: string | Error | unknown) => {
    if (message instanceof Error) handleError(err, options)
    else if (message instanceof Error) handleError(options)
    else handleError(err, options)

    const errorMessage = isString(message) ? message : message instanceof Error ? message.message : String(message)
    log.message(errorMessage, { symbol: color.red(S_ERROR) })
    writeToLogFile(`ERROR: ${errorMessage}`)
  },

  debug: (...args: any[]) => {
    console.debug(...args)
    writeToLogFile(`DEBUG: ${args.join(' ')}`)
  },

  start: consola.start,
  box: consola.box,
  prompt: getPrompt,
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
