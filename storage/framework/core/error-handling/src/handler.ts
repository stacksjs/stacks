import { italic } from '@stacksjs/cli'
import * as path from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import fs from 'fs-extra'

interface ErrorOptions {
  silent?: boolean
}

type ErrorMessage = string

export class ErrorHandler {
  static isTestEnvironment = false
  static shouldExitProcess = true

  static handle(err: Error | ErrorMessage | unknown, options?: ErrorOptions): Error {
    if (options?.silent !== true) this.writeErrorToConsole(err)

    let error: Error
    if (err instanceof Error) {
      error = err
    } else if (typeof err === 'string') {
      error = new Error(err)
    } else {
      error = new Error(JSON.stringify(err))
    }

    this.writeErrorToFile(error).catch((e) => console.error(e))

    return error
  }

  static handleError(err: Error, options?: ErrorOptions): Error {
    this.handle(err, options)
    return err
  }

  static async writeErrorToFile(err: Error | unknown) {
    if (!(err instanceof Error)) {
      console.error('Error is not an instance of Error:', err)
      return
    }

    const formattedError = `[${new Date().toISOString()}] ${err.name}: ${err.message}\n`
    const logFilePath = path.logsPath('stacks.log') ?? path.logsPath('errors.log')

    try {
      await fs.mkdir(path.dirname(logFilePath), { recursive: true })
      await fs.appendFile(logFilePath, formattedError)
    } catch (error) {
      console.error('Failed to write to error file:', error)
    }
  }

  static writeErrorToConsole(err: string | Error | unknown): void {
    console.error(err)

    const errorString = typeof err === 'string' ? err : err instanceof Error ? err.message : JSON.stringify(err)

    if (
      errorString.includes('bunx --bun cdk destroy') ||
      errorString === `Failed to execute command: ${italic('bunx --bun biome check --fix')}` ||
      errorString === `Failed to execute command: ${italic('bun storage/framework/core/actions/src/lint/fix.ts')}`
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

export function handleError(err: ErrorMessage | Error | unknown, options?: ErrorOptions): Error {
  return ErrorHandler.handle(err, options)
}
