import { ray as debug } from 'node-ray'
import { consola } from 'consola'

export function dump(...args: any[]) {
  return debug(...args)
}

export function dd(...args: any[]) {
  return dump(...args).showApp()
}

export const logger = consola

export const log = logger
