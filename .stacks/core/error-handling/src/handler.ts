import { logsPath } from '@stacksjs/path'
import type { StacksError } from '@stacksjs/types'

export class ErrorHandler {
  static logFile = logsPath('errors.log')

  static handle(err: string | StacksError, options?: any) {
    this.writeErrorToConsole(err, options)
    this.writeErrorToFile(err)

    return err
  }

  static handleError(err: Error, options?: any) {
    this.handle(err, options)
    return err
  }

  static async writeErrorToFile(err: StacksError) {
    const formattedError = `[${new Date().toISOString()}] ${err.name}: ${err.message}\n`
    const file = Bun.file(this.logFile)
    const writer = file.writer()
    const text = await file.text()
    writer.write(`${text}\n`)
    writer.write(`${formattedError}\n`)
    await writer.end()
  }

  static writeErrorToConsole(err: string | StacksError, options?: any) {
    if (options)
      console.error(err, options)
    else
      console.error(err)
  }
}

export function handleError(err: StacksError | string, options?: any): StacksError {
  return ErrorHandler.handle(err, options)
}
