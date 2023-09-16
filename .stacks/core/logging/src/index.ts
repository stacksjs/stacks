/* eslint-disable @typescript-eslint/no-unsafe-argument */
import process from 'node:process'
import { handleError } from '@stacksjs/error-handling'
import { bold, green, prompts } from '@stacksjs/cli'
import { ray as debug } from 'node-ray'
import type { StacksError } from '@stacksjs/types'

export function dump(...args: any[]) {
  return debug(...args)
}

export function dd(...args: any[]) {
  return dump(...args).showApp()
}

export const logger = console
export const log = {
  info: (...args: any[]) => logger.info(...args),
  success: (msg: string) => logger.log(bold(green(msg))),
  error: (err: string | StacksError, options?: any) => handleError(err, options),
  warn: (...args: any[]) => logger.warn(...args),
  debug: (...args: any[]) => {
    if (process.env.DEBUG)
      logger.debug(...args)
  },
  prompt: prompts,
  dump,
  dd,
}
