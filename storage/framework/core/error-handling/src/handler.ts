import type { ErrorOptions } from '@stacksjs/logging'
import { access, appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { italic, stripAnsi } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import * as path from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { isString } from '@stacksjs/validation'

type ErrorMessage = string

export class ErrorHandler {
  static isTestEnvironment = false
  static shouldExitProcess = true

  static handle(err: Error | ErrorMessage | unknown, options?: ErrorOptions): Error {
    this.shouldExitProcess = options?.shouldExit !== false
    if (options?.silent !== true)
      this.writeErrorToConsole(err)

    let error: Error
    let errorMessage: string

    if (options?.message) {
      // Use the message from options if provided
      errorMessage = options.message
    }
    else if (err instanceof Error) {
      errorMessage = err.message
    }
    else if (typeof err === 'string') {
      errorMessage = err
    }
    else {
      errorMessage = JSON.stringify(err)
    }

    // Create a new Error with the determined message
    error = new Error(errorMessage)

    // If the original err was an Error instance, copy its properties
    if (err instanceof Error) {
      Object.assign(error, err)
    }

    this.writeErrorToFile(error).catch(e => console.error(e))

    return error
  }

  static handleError(err: Error, options?: ErrorOptions): Error {
    this.handle(err, options)
    return err
  }

  static async writeErrorToFile(err: Error | unknown): Promise<void> {
    if (!(err instanceof Error)) {
      console.error('Error is not an instance of Error:', err)
      return
    }

    const formattedError = `[${new Date().toISOString()}] ${err.name}: ${err.message}\n`
    const logFilePath = path.logsPath('stacks.log') ?? path.logsPath('errors.log')

    try {
      await mkdir(path.dirname(logFilePath), { recursive: true })
      await appendFile(logFilePath, formattedError)
    }
    catch (error) {
      console.error('Failed to write to error file:', error)
    }
  }

  static writeErrorToConsole(err: string | Error | unknown): void {
    console.error(err)

    const errorString = typeof err === 'string' ? err : err instanceof Error ? err.message : JSON.stringify(err)

    if (
      errorString.includes('bunx --bun cdk destroy')
      || errorString === `Failed to execute command: ${italic('bunx --bun eslint . --fix')}`
      || errorString === `Failed to execute command: ${italic('bun storage/framework/core/actions/src/lint/fix.ts')}`
    ) {
      if (!this.isTestEnvironment) {
        console.log(
          'No need to worry. The edge function is currently being destroyed. Please run `buddy undeploy` shortly again, and continue doing so until it succeeds running.',
        )
        console.log('Hoping to see you back soon!')
      }
    }

    if (this.shouldExitProcess) {
      process.exit(ExitCode.FatalError)
    }
  }
}

export function handleError(err: string | Error | object | unknown, options?: ErrorOptions): Error {
  let errorMessage: string

  if (isString(err)) {
    errorMessage = err
  }
  else if (err instanceof Error) {
    errorMessage = err.message
  }
  else if (options instanceof Error) {
    errorMessage = options.message
  }
  else {
    errorMessage = String(err)
  }

  writeToLogFile(`ERROR: ${stripAnsi(errorMessage)}`)

  return ErrorHandler.handle(err, options)
}

interface WriteOptions {
  logFile?: string
}

export async function writeToLogFile(message: string, options?: WriteOptions): Promise<void> {
  const formattedMessage = `[${new Date().toISOString()}] ${message}\n`

  try {
    const logFile = options?.logFile ?? config.logging.logsPath ?? 'storage/logs/stacks.log'

    try {
      // Check if the file exists
      await access(logFile)
    }
    catch {
      // File doesn't exist, create the directory
      console.log('Creating log file directory...', logFile)
      await mkdir(dirname(logFile), { recursive: true })
    }

    // Append the message to the log file
    await appendFile(logFile, formattedMessage)
  }
  catch (error) {
    console.error('Failed to write to log file:', error)
  }
}
