import * as path from '@stacksjs/path'
import fs from 'fs-extra'

interface ErrorOptions {
  silent?: boolean
}

export const StacksError = Error

export class ErrorHandler {
  // static logFile = path.logsPath('errors.log')

  static handle(err: ErrorDescription | Error, options?: ErrorOptions): Error {
    // let's only write to the console if we are not in silent mode
    if (options?.silent !== false)
      this.writeErrorToConsole(err)

    if (typeof err === 'string')
      err = new StacksError(err)

    this.writeErrorToFile(err).catch(e => console.error(e))

    return err
  }

  static handleError(err: Error, options?: ErrorOptions): Error {
    this.handle(err, options)
    return err
  }

  static async writeErrorToFile(err: Error) {
    const formattedError = `[${new Date().toISOString()}] ${err.name}: ${err.message}\n`
    const errorsLogFilePath = path.logsPath('errors.log')

    try {
      // Ensure the directory exists
      await fs.mkdir(path.dirname(errorsLogFilePath), { recursive: true })
      // Append the message to the log file
      await fs.appendFile(errorsLogFilePath, formattedError)
    }
    catch (error) {
      console.error('Failed to write to error file:', error)
    }
  }

  static writeErrorToConsole(err: string | Error): void {
    console.error(err)
  }
}

type ErrorDescription = string
export function handleError(err: ErrorDescription | Error, options?: ErrorOptions): Error {
  return ErrorHandler.handle(err, options)
}
