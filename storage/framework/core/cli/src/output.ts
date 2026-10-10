import { writeSync } from 'node:fs'
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

function writeLine(fd: number, message: string): void {
  const bytes = Buffer.from(`${message}\n`)
  let offset = 0
  while (offset < bytes.length)
    offset += writeSync(fd, bytes, offset, bytes.length - offset)
}
