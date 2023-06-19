import { fs } from '@stacksjs/storage'
import { log } from '@stacksjs/cli'
import { logsPath } from '@stacksjs/path'
import { ValidationError } from '@stacksjs/types'
import type { StacksError } from '@stacksjs/types'

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

  static handle(err: StacksError, options?: any) {
    this.writeErrorToConsole(err, options)
    this.writeErrorToFile(err)
  }

  static handleError(err: Error, options?: any) {
    this.handle(err, options)
  }

  static writeErrorToFile(err: StacksError) {
    let formattedError: string

    if (err instanceof ValidationError)
      formattedError = `[${new Date().toISOString()}] ${err.name}: ${err.messages}\n`
    else
      formattedError = `[${new Date().toISOString()}] ${err.name}: ${err.message}\n`

    fs.appendFile(this.logFile, formattedError, 'utf8')
      .catch((err) => {
        log.error(`Failed to write error to ./storage/logs/errors.log: ${italic(err.message)}`, err)
      })
  }

  static writeErrorToConsole(err: StacksError, options?: any) {
    log.error(err, options)
  }
}

export function handleError(err: StacksError, options?: any): void {
  ErrorHandler.handle(err, options)
}
