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
  // eslint-disable-next-line no-console
  success: console.log, // TODO: create a proper success method
  prompt: prompts,
  ...logger,
}
