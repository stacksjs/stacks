import { fs } from '@stacksjs/storage'
import { log } from '@stacksjs/cli'
import { logsPath } from '@stacksjs/path'

export {
  Err,
  Ok,
  Result,
  ResultAsync,
  err,
  errAsync,
  fromPromise,
  fromSafePromise,
  fromThrowable,
  ok,
  okAsync,
} from 'neverthrow'

class ErrorHandler {
  static logFile = logsPath('errors.log')

  static handle(err: Error, options?: any) {
    this.writeErrorToConsole(err, options)
    this.writeErrorToFile(err, options)
  }

  static handleError(err: Error, options?: any) {
    this.handle(err, options)
  }

  static writeErrorToFile(err: Error, options?: any) {
    const formattedError = `[${new Date().toISOString()}] ${err.name}: ${err.message}\n`

    fs.appendFile(this.logFile, formattedError, 'utf8')
      .then(() => {})
      .catch((err) => {
        log.error(`Failed to write error to ./storage/logs/errors.log: ${italic(err.message)}`, err)
      })
  }

  static writeErrorToConsole(err: Error, options?: any) {
    log.error(err, options)
  }
}

export function handleError(err: Error, options?: any): void {
  ErrorHandler.handle(err, options)
}
