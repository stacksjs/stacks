import process from 'node:process'
import consola from 'consola'
import { ExitCode } from 'src/types/src'

export const logger = consola
export const log = consola
// export const log = {
//   info: (...args: any[]) => consola.info(...args),
//   success: (msg: string) => logger.success(msg),
//   error: (err: string | StacksError, options?: any) => handleError(err, options),
//   warn: (...args: any[]) => logger.warn(...args),
//   debug: (...args: any[]) => logger.debug(...args),
//   prompt:
//   dump,
//   dd,
// }

export function dump(...args: any[]) {
  return log.debug(args)
}

export function dd(...args: any[]) {
  args.forEach(arg => log.debug(arg))
  // we need to return a non-zero exit code to indicate an error
  // e.g. if used in a CDK script, we want it to fail the deployment
  process.exit(ExitCode.FatalError)
}
