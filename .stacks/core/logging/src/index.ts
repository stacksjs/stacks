import { ray as debug } from 'node-ray'

export function dump(...args: any[]) {
  return debug(...args)
}

export function dd(...args: any[]) {
  return dump(...args).showApp()
}

export { consola as log } from 'consola'
