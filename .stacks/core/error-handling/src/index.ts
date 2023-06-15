import { fs } from '@stacksjs/storage'
import { log } from '@stacksjs/logging'
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

  static handleError(err: Error, options?: any) {
    // todo: options is currently not used
    // eslint-disable-next-line no-console
    console.log('here')
    log.error(err, options)
    this.writeErrorToFile(err, options)
  }

  static writeErrorToFile(err: Error, options?: any) {
    const formattedError = `[${new Date().toISOString()}] ${err.name}: ${err.message}\n`
    fs.appendFile(this.logFile, formattedError, (err: any) => {
      if (err)
        log.error('Failed to write error to log file', options)
    })
  }
}

export function handleError(err: Error, options?: any): void {
  ErrorHandler.handleError(err, options)
}
