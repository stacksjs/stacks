import { logsPath } from '@stacksjs/path'

interface ErrorOptions {
  silent?: boolean
}

export const StacksError = Error

export class ErrorHandler {
  static logFile = logsPath('errors.log')

  static handle(err: ErrorDescription | Error, options?: ErrorOptions | Error) {
    // let's only write to the console if we are not in silent mode
    if (!(options instanceof Error) && options?.silent !== false)
      this.writeErrorToConsole(err, options)

    if (typeof err === 'string')
      err = new StacksError(err)

    this.writeErrorToFile(err).catch(e => console.error(e))

    return err
  }

  static handleError(err: Error, options?: ErrorOptions) {
    this.handle(err, options)
    return err
  }

  static async writeErrorToFile(err: Error) {
    const formattedError = `[${new Date().toISOString()}] ${err.name}: ${err.message}\n`
    const file = Bun.file(this.logFile)
    const writer = file.writer()
    const text = await file.text()
    writer.write(`${text}\n`)
    writer.write(`${formattedError}\n`)
    await writer.end()
  }

  static writeErrorToConsole(err: string | Error, options?: ErrorOptions) {
    if (options)
      console.error(err, options)
    else
      console.error(err)
  }
}

type ErrorDescription = string
export function handleError(err: ErrorDescription | Error, options?: ErrorOptions | Error): Error {
  return ErrorHandler.handle(err, options)
}
