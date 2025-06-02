import type { LogErrorOptions } from '@stacksjs/logging'
import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import * as process from 'node:process'
import { italic, stripAnsi } from '@stacksjs/cli'
import * as path from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import fs from 'fs-extra'

type ErrorMessage = string

export class ErrorHandler {
  static isTestEnvironment = false
  static shouldExitProcess = true

  static handle(err: Error | ErrorMessage | unknown, options?: LogErrorOptions): Error {
    this.shouldExitProcess = options?.shouldExit !== false
    if (options?.silent !== true)
      this.writeErrorToConsole(err)

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
    const error = new Error(errorMessage)

    // If the original err was an Error instance, copy its properties
    if (err instanceof Error) {
      Object.assign(error, err)
    }

    this.writeErrorToFile(error).catch(e => console.error(e))

    return error
  }

  static handleError(err: Error, options?: LogErrorOptions): Error {
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
    let errorString: string

    if (err instanceof Error) {
      errorString = err.message
    }
    else if (typeof err === 'string') {
      errorString = err
    }
    else {
      errorString = JSON.stringify(err)
    }

    console.error(errorString)

    if (
      errorString.includes('bunx --bun cdk destroy')
      || errorString === `Failed to execute command: ${italic('bunx --bun eslint . --fix')}`
      || errorString === `Failed to execute command: ${italic('bun storage/framework/core/actions/src/lint/fix.ts')}`
    ) {
      if (!this.isTestEnvironment) {
        // eslint-disable-next-line no-console
        console.log(
          'No need to worry. The edge function is currently being destroyed. Please run `buddy undeploy` shortly again, and continue doing so until it succeeds running.',
        )
        // eslint-disable-next-line no-console
        console.log('Hoping to see you back soon!')
      }
    }

    if (this.shouldExitProcess) {
      process.exit(ExitCode.FatalError)
    }
  }
}

interface WriteOptions {
  logFile?: string
}

// Default log path that will be used if config isn't initialized yet
let defaultLogPath = 'storage/logs/stacks.log'

// Function to update the default log path when config is available
export function setLogPath(path: string): void {
  defaultLogPath = path
}

export async function writeToLogFile(message: string, options?: WriteOptions): Promise<void> {
  const timestamp = new Date().toISOString()
  const formattedMessage = `[${timestamp}] ${message}\n`

  // Use options or default path instead of config
  const logFile = options?.logFile ?? defaultLogPath
  const dirPath = dirname(logFile)

  if (!fs.existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true })
  }

  // Write to the log file
  await appendFile(logFile, formattedMessage)
}

export function handleError(
  err: string | Error | object | unknown,
  options?: LogErrorOptions | Record<string, any>,
): Error {
  let errorMessage: string
  let contextData: Record<string, any> | undefined

  // Check if options is a context object (not an ErrorOptions)
  if (options
    && typeof options === 'object'
    && !('shouldExit' in options)
    && !('silent' in options)
    && !('message' in options)) {
    contextData = options as Record<string, any>
    options = undefined
  }

  // Get the error message from the error object first
  const errMsg = err instanceof Error ? err.message : String(err)

  if (options && 'message' in options) {
    // If options is provided with a message, put the context message first
    errorMessage = `${errMsg}: ${options.message}`
  }
  else {
    // If options is not provided or doesn't have a message, use the error message
    errorMessage = errMsg
  }

  // Build log message with context if available
  let logMessage = `ERROR: ${stripAnsi(errorMessage)}`
  if (contextData) {
    logMessage += `\nContext: ${JSON.stringify(contextData, null, 2)}`
  }

  writeToLogFile(logMessage)

  // Create a new Error with the combined message
  const error = new Error(errorMessage)
  if (err instanceof Error) {
    Object.assign(error, err)
  }

  return ErrorHandler.handle(error, { ...options as ErrorOptions, message: errorMessage })
}
