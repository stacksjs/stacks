import type { LogErrorOptions } from '@stacksjs/logging'
import fs from 'node:fs'
import { dirname } from 'node:path'
import * as process from 'node:process'
// Inlined to avoid circular dependency: error-handling -> cli -> error-handling
function italic(str: string): string {
  return `\x1B[3m${str}\x1B[23m`
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, '')
}
import * as path from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

/**
 * Context information attached to errors for better debugging.
 */
export interface ErrorContext {
  requestId?: string
  url?: string
  method?: string
  userId?: string | number
  ip?: string
  userAgent?: string
  [key: string]: unknown
}

type ErrorMessage = string

export class ErrorHandler {
  static isTestEnvironment = false
  static shouldExitProcess = false

  static handle(err: Error | ErrorMessage | unknown, options?: LogErrorOptions): Error {
    if (!this.isTestEnvironment)
      this.shouldExitProcess = options?.shouldExit === true
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

    // An Error that already says the right thing is passed through as-is.
    // Rebuilding it used to drop `stack` and `cause` on the floor - both are
    // non-enumerable, so Object.assign never copied them - which threw away
    // the throw site and the underlying failure on every single error the
    // framework reported.
    const error = err instanceof Error && errorMessage === err.message
      ? err
      : new Error(errorMessage, err instanceof Error ? { cause: err.cause ?? err } : undefined)

    if (err instanceof Error && error !== err) {
      Object.assign(error, err)
      if (err.stack)
        error.stack = `${error.name}: ${errorMessage}\n${err.stack.split('\n').slice(1).join('\n')}`
    }

    this.writeErrorToFile(error).catch(e => console.error(e))

    return error
  }

  static handleError(err: Error, options?: LogErrorOptions): Error {
    this.handle(err, options)
    return err
  }

  static async writeErrorToFile(err: Error | unknown, context?: ErrorContext): Promise<void> {
    if (!(err instanceof Error)) {
      console.error('Error is not an instance of Error:', err)
      return
    }

    const contextStr = context
      ? ` | url=${context.url || 'N/A'} method=${context.method || 'N/A'} user=${context.userId || 'anonymous'}`
      : ''
    const stackLine = err.stack ? `\n${err.stack.split('\n').slice(1, 4).join('\n')}` : ''
    const formattedError = `[${new Date().toISOString()}] ${err.name}: ${err.message}${contextStr}${stackLine}\n`
    const logFilePath = path.logsPath('stacks.log') ?? path.logsPath('errors.log')

    try {
      await fs.promises.mkdir(path.dirname(logFilePath), { recursive: true })
      await fs.promises.appendFile(logFilePath, formattedError)
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

  await fs.promises.mkdir(dirPath, { recursive: true })

  // Write to the log file
  await fs.promises.appendFile(logFile, formattedMessage)
}

/**
 * JSON.stringify drops everything that matters about an Error: `message`,
 * `stack` and `cause` are all non-enumerable, so an Error anywhere in the
 * context object serialises to `{}`. Context is the only record of what
 * actually went wrong once the process is gone, so unwrap them by hand.
 */
function serializableContext(value: unknown, seen = new Set<unknown>()): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(value.cause !== undefined ? { cause: serializableContext(value.cause, seen) } : {}),
    }
  }

  if (!value || typeof value !== 'object')
    return value

  if (seen.has(value))
    return '[circular]'

  seen.add(value)

  if (Array.isArray(value))
    return value.map(entry => serializableContext(entry, seen))

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, serializableContext(entry, seen)]),
  )
}

export function handleError(
  err: string | Error | object | unknown,
  options?: unknown,
): Error {
  let errorMessage: string
  let contextData: Record<string, any> | undefined
  let errorOptions: LogErrorOptions | undefined

  // `handleError('Migration generation failed', error)` reads naturally and is
  // used throughout the framework, but the second argument used to be filed as
  // opaque context — and since JSON.stringify(error) is `{}`, the real failure
  // was destroyed at exactly the call sites that needed it most. A thrown value
  // in that position is the cause of the label, so treat it as one.
  const cause = options instanceof Error ? options : undefined

  if (!cause && options && typeof options === 'object' && ('shouldExit' in options || 'silent' in options)) {
    errorOptions = options as LogErrorOptions
  }
  else if (!cause && options !== undefined) {
    contextData = options && typeof options === 'object'
      ? options as Record<string, any>
      : { error: options }
  }

  // Get the error message from the error object first
  const errMsg = err instanceof Error ? err.message : (typeof err === 'string' ? err : JSON.stringify(err))

  if (errorOptions?.message) {
    // If options is provided with a message, put the context message first
    errorMessage = `${errMsg}: ${errorOptions.message}`
  }
  else if (cause) {
    // The label alone ("Migration generation failed") says nothing about what
    // broke. Lead with it, because it names the operation, then the cause.
    errorMessage = cause.message && cause.message !== errMsg ? `${errMsg}: ${cause.message}` : errMsg
  }
  else {
    // If options is not provided or doesn't have a message, use the error message
    errorMessage = errMsg
  }

  // Build log message with context if available
  let logMessage = `ERROR: ${stripAnsi(errorMessage)}`
  if (contextData) {
    logMessage += `\nContext: ${JSON.stringify(serializableContext(contextData), null, 2)}`
  }
  if (cause?.stack) {
    logMessage += `\nCaused by: ${stripAnsi(cause.stack)}`
  }

  writeToLogFile(logMessage).catch((err) => {
    console.error('Failed to write error log:', err)
  })

  // Create a new Error with the combined message
  const error = cause ? new Error(errorMessage, { cause }) : new Error(errorMessage)
  if (err instanceof Error) {
    Object.assign(error, err)
  }

  // A new Error() stack starts here, inside the handler, which is never where
  // the interesting frames are. Keep the cause's stack so the trace still
  // points at the throw site, with the label as its first line.
  if (cause?.stack)
    error.stack = `${error.name}: ${errorMessage}\n${cause.stack.split('\n').slice(1).join('\n')}`

  return ErrorHandler.handle(error, errorOptions)
}
