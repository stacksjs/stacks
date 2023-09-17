/* eslint-disable @typescript-eslint/no-unsafe-argument */
import process from 'node:process'
import { handleError } from '@stacksjs/error-handling'
import { bold, green } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import type { StacksError } from '@stacksjs/types'

export const logger = console
export const log = {
  info: (...args: any[]) => logger.info(...args),
  success: (msg: string) => logger.log(bold(green(msg))),
  error: (err: string | StacksError, options?: any) => handleError(err, options),
  warn: (...args: any[]) => logger.warn(...args),
  debug: (...args: any[]) => logger.debug(...args),
  // prompt: prompts,
  dump,
  dd,
}

export function dump(...args: any[]) {
  // return debug(...args)
  return log.debug(...args)
}

export function dd(...args: any[]) {
  args.forEach(arg => log.debug(arg))
  process.exit(ExitCode.Success)
}
