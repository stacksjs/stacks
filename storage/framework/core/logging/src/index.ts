import process from 'node:process'
import consola from 'consola'
import { ExitCode } from '@stacksjs/types'
import { logsPath } from '@stacksjs/path'

export const logger = consola

export const logFilePath = logsPath('console.log')

async function writeToLogFile(message: string) {
  const formattedMessage = `[${new Date().toISOString()}] ${message}\n`
  try {
    const file = Bun.file(logFilePath)
    const writer = file.writer()
    const text = await file.text()
    writer.write(`${text}\n`)
    writer.write(`${formattedMessage}\n`)
    await writer.end()
  }
  catch (error) {
    // Assuming the error is due to the file not existing
    // Create the file and then write the message
    const file = Bun.file(logFilePath) // Use the create option
    const writer = file.writer()
    writer.write(`${formattedMessage}\n`)
    await writer.end()
  }
}

export const log = {
  info: async (...arg: any) => {
    // @ts-expect-error intentional
    consola.info(...arg)
    await writeToLogFile(`INFO: ${arg}`)
  },

  success: async (msg: string) => {
    consola.success(msg)
    await writeToLogFile(`SUCCESS: ${msg}`)
  },

  error: async (err: string, options?: any) => {
    handleError(err, options) // Assuming handleError logs the error
    await writeToLogFile(`ERROR: ${err}`)
  },

  warn: async (arg: string) => {
    consola.warn(arg)
    await writeToLogFile(`WARN: ${arg}`)
  },

  debug: async (...arg: any) => {
    // @ts-expect-error intentional
    consola.debug(...arg)
    await writeToLogFile(`DEBUG: ${arg}`)
  },

  // prompt,
  dump,
  dd,
}

export function dump(...args: any[]) {
  args.forEach(arg => log.debug(arg))
}

export function dd(...args: any[]) {
  args.forEach(arg => log.debug(arg))
  // we need to return a non-zero exit code to indicate an error
  // e.g. if used in a CDK script, we want it to fail the deployment
  process.exit(ExitCode.FatalError)
}
