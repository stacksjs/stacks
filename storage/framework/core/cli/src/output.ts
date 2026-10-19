import { writeSync } from 'node:fs'
import type { Writable } from 'node:stream'
import { format } from 'node:util'

/**
 * Print plain terminal output, preserving inspection and formatting placeholders.
 * Unlike application logs, command results and test tallies must remain visible
 * regardless of the configured log level and must survive an immediate exit.
 */
export function print(...args: unknown[]): void {
  writeLine(1, format(...args))
}

/** Print a plain diagnostic to stderr without changing the process exit code. */
export function printError(...args: unknown[]): void {
  writeLine(2, format(...args))
}

/** Print to stdout, awaiting completion even when a pipe applies backpressure. */
export async function printAsync(...args: unknown[]): Promise<void> {
  await writeLineAsync(process.stdout, format(...args))
}

/** Print to stderr, awaiting completion without changing the exit code. */
export async function printErrorAsync(...args: unknown[]): Promise<void> {
  await writeLineAsync(process.stderr, format(...args))
}

function writeLineAsync(stream: Writable, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      stream.off('error', onError)
      reject(error)
    }
    stream.once('error', onError)
    try {
      stream.write(`${message}\n`, 'utf8', (error) => {
        if (error) {
          // Writable emits the error after calling its write callback. Keep
          // this write's listener through that notification, then remove it.
          setImmediate(() => stream.off('error', onError))
          reject(error)
        }
        else {
          stream.off('error', onError)
          resolve()
        }
      })
    }
    catch (error) {
      stream.off('error', onError)
      reject(error)
    }
  })
}

function writeLine(fd: number, message: string): void {
  const bytes = Buffer.from(`${message}\n`)
  let offset = 0
  while (offset < bytes.length)
    offset += writeSync(fd, bytes, offset, bytes.length - offset)
}
