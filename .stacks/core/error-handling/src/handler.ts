import { logsPath } from '@stacksjs/path'
import { type StacksError, type ValidationError } from '@stacksjs/types'
import { fs } from '@stacksjs/storage'
import { italic, log } from '@stacksjs/cli'

export class ErrorHandler {
  static logFile = logsPath('errors.log')

  static handle(err: StacksError, options?: any) {
    this.writeErrorToConsole(err, options)
    this.writeErrorToFile(err)
    return err
  }

  static handleError(err: Error, options?: any) {
    this.handle(err, options)
    return err
  }

  static writeErrorToFile(err: StacksError) {
    let formattedError: string

    if (isErrorOfTypeValidation(err))
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

export function handleError(err: StacksError, options?: any): StacksError {
  return ErrorHandler.handle(err, options)
}

function isErrorOfTypeValidation(err: any): err is ValidationError {
  return err && typeof err.message === 'string'
}
