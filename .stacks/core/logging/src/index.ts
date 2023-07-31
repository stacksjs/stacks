import { prompts } from '@stacksjs/cli'
import { ray as debug } from 'node-ray'

export function dump(...args: any[]) {
  return debug(...args)
}

export function dd(...args: any[]) {
  return dump(...args).showApp()
}

export const logger = console
export const log = {
  success: (...args: any[]) => logger.log(...args),
  prompt: prompts,
  ...logger,
}
