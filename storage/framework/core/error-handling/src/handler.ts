import { italic } from '@stacksjs/cli'
import * as path from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import fs from 'fs-extra'

interface ErrorOptions {
  silent?: boolean
}

export const StacksError = Error

export class ErrorHandler {
  // static logFile = path.logsPath('errors.log')

  static handle(err: ErrorDescription | Error | unknown, options?: ErrorOptions): Error {
    // let's only write to the console if we are not in silent mode
    if (options?.silent !== false) this.writeErrorToConsole(err)

    if (typeof err === 'string') err = new StacksError(err)
    if (typeof err === 'object') err = err as Error

    this.writeErrorToFile(err).catch((e) => console.error(e))

    return err as Error // TODO: improve this type
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
      // Ensure the directory exists
      await fs.mkdir(path.dirname(logFilePath), { recursive: true })
      // Append the message to the log file
      await fs.appendFile(logFilePath, formattedError)
    } catch (error) {
      console.error('Failed to write to error file:', error)
    }
  }

  static writeErrorToConsole(err: string | Error | unknown): void {
    if (
      err === `Failed to execute command: ${italic('bunx biome check --fix')}` ||
      err === `Failed to execute command: ${italic('bun --bun storage/framework/core/actions/src/lint/fix.ts')}`
    ) {
      // To trigger this, run `buddy release` with a lint error in your codebase
      console.error(err)
      process.exit(ExitCode.FatalError) // TODO: abstract this by differently catching the error somewhere
    }

    // when "undeploying," there currently is a chance that edge functions can't be destroyed yet, because of their distributed nature
    // this is a temporary fix until AWS improves this on their side
    if (typeof err === 'string' && err.includes('Failed to execute command:') && err.includes('bunx cdk destroy')) {
      console.error(err)
      console.log(
        'No need to worry. The edge function is currently being destroyed. Please run `buddy undeploy` shortly again, and continue doing so until it succeeds running.',
      )
      console.log('Hoping to see you back soon!')
      process.exit(ExitCode.FatalError) // TODO: abstract this by differently catching the error somewhere
    }

    console.error(err)
  }
}

type ErrorDescription = string

export function handleError(err: ErrorDescription | Error | unknown, options?: ErrorOptions): Error {
  return ErrorHandler.handle(err, options)
}
