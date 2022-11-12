import consola from 'consola'
import { ray } from 'node-ray'

const debug = ray
const log = consola

function dump(...args: any[]) {
  return debug(...args)
}

function dd(...args: any[]) {
  return debug(args).die()
}

export { log, debug, dd, dump, ray }
