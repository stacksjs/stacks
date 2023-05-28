import { fs } from '@stacksjs/storage'
import { log } from '@stacksjs/logging'
import { ExitCode } from 'stacks/core/types'

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
  static logFile = path.join(__dirname, './storage/logs/errors.log')

  static handleError(err: Error) {
    log.error(error)
    process.exit(ExitCode.FatalError)

    console.error(err)
    this.writeErrorToFile(err)
  }

  static writeErrorToFile(err: Error) {
    const formattedError = `[${new Date().toISOString()}] ${err.name}: ${err.message}\n`
    fs.appendFile(this.logFile, formattedError, (err) => {
      if (err)
        console.error('Failed to write error to log file')
    })
  }
}

export function errorHandler(error: Error | string, options?: any): void {
  (new ErrorHandler()).handleError(error)
}
